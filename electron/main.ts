import { app, BrowserWindow, dialog, ipcMain, nativeTheme, safeStorage, shell } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import AdmZip from "adm-zip";
import type { MessageParam, ContentBlock, Message } from "@anthropic-ai/sdk/resources/messages";
import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import { AttachmentStore, type Attachment } from "./attachments";
import { listMemoryFiles, runMemoryCommand } from "./memory";
import { createBackup, readBackup, restoreEntries } from "./backup";
import { formatHits, searchPastChats } from "./pastChats";
import { setupUpdater } from "./updater";
import { getMainLocale, mainT, resolveMainLocale, setMainLocale } from "./i18n";
import { connectorRequest, MCP_CONNECTOR_BETA, serverName, validateConnector, type Connector, type ConnectorView } from "./connectors";
import { desktopConfigPath, LocalMcpPool, parseDesktopConfig, parseEnv, toolDefinitions, toToolResult, validateLocal, type LocalServer, type LocalToolRef } from "./localMcp";
import { HANDOFF_PREFIX, fitsHandoff } from "../src/lib/handoff";
import { activityLabel, buildMessages, historyBudget, buildSystem, buildTools, extractFileIds, extractSteps, extractText, type ChatTurn, type Project, type StyleId, type ToolFlags } from "./request";

// Only `npm run dev` passes --dev; `npm start` after a build must load the bundled renderer.
const isDev = !app.isPackaged && process.argv.includes("--dev");
let mainWindow: BrowserWindow | null = null;
const dataDir = () => path.join(app.getPath("userData"), "claude-continuity");
const sessionId = randomUUID();
const keyFile = () => path.join(dataDir(), "api-key.bin");

async function ensureDataDir() { await fs.mkdir(dataDir(), { recursive: true }); }
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 620,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#262522" : "#FAF9F5", title: "Claude Continuity",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  // Links in replies and guides open in the system browser; the app window never navigates away.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault();
  });
  if (isDev) void mainWindow.loadURL("http://127.0.0.1:5173");
  else void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.whenReady().then(async () => {
  await ensureDataDir();
  // The renderer follows prefers-color-scheme, which nativeTheme.themeSource controls.
  const prefs = await loadPrefs();
  nativeTheme.themeSource = prefs.theme;
  applyLanguage(prefs.language);
  createWindow();
  setupUpdater(() => mainWindow, { enabled: async () => (await loadPrefs()).checkUpdates });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("will-quit", () => { void localPool.closeAll(); });

const localPool = new LocalMcpPool({ name: "claude-continuity", version: app.getVersion() });
const localServer = (c: Connector): LocalServer => ({ id: c.id, name: c.name, command: c.command ?? "", args: c.args ?? [], env: c.env ?? {} });

type NormalizedMessage = { role: "user" | "assistant"; content: string };
type NormalizedConversation = { id: string; title: string; messages: NormalizedMessage[]; source: string; updatedAt?: string };

function textFromMessage(message: any): string {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return "";
  if (typeof message.text === "string") return message.text;
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map((part: any) => typeof part === "string" ? part :
      (part && typeof part.text === "string" ? part.text : "")).filter(Boolean).join("\n");
  }
  if (Array.isArray(message.fragments)) return message.fragments.map((part: any) => textFromMessage(part)).filter(Boolean).join("\n");
  return "";
}
function normalizeRole(message: any): "user" | "assistant" | null {
  const raw = String(message?.sender ?? message?.role ?? message?.author?.role ?? message?.type ?? "").toLowerCase();
  if (["human", "user", "prompt"].includes(raw)) return "user";
  if (["assistant", "claude", "model"].includes(raw)) return "assistant";
  return null;
}
function extractMessages(raw: any): NormalizedMessage[] {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.chat_messages) ? raw.chat_messages :
    Array.isArray(raw?.messages) ? raw.messages : Array.isArray(raw?.conversation?.messages) ? raw.conversation.messages : [];
  return list.map((item: any) => ({ role: normalizeRole(item), content: textFromMessage(item) }))
    .filter((item: any): item is NormalizedMessage => !!item.role && !!item.content.trim());
}
function findConversationArrays(value: any, found: any[] = [], depth = 0): any[] {
  if (depth > 8 || value == null) return found;
  if (Array.isArray(value)) {
    const conversationLike = value.filter((item: any) => item && typeof item === "object" &&
      (Array.isArray(item.chat_messages) || Array.isArray(item.messages) || Array.isArray(item.conversation?.messages)));
    if (conversationLike.length) found.push(...conversationLike);
    else for (const item of value) findConversationArrays(item, found, depth + 1);
  } else if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (["conversations", "chats", "threads"].includes(key.toLowerCase()) && Array.isArray(child)) {
        const candidates = (child as any[]).filter(item => item && typeof item === "object");
        found.push(...candidates);
      } else findConversationArrays(child, found, depth + 1);
    }
  }
  return found;
}
function isoDate(value: unknown): { updatedAt?: string } {
  const time = typeof value === "string" || typeof value === "number" ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? { updatedAt: new Date(time).toISOString() } : {};
}
function parseExportText(text: string, source: string): NormalizedConversation[] {
  let data: any;
  try { data = JSON.parse(text); } catch { return []; }
  const candidates = Array.isArray(data) ? data : findConversationArrays(data);
  const unique = new Map<string, NormalizedConversation>();
  for (const item of candidates) {
    const messages = extractMessages(item);
    if (!messages.length) continue;
    const id = String(item.uuid ?? item.id ?? item.conversation_id ?? `import-${unique.size}`);
    unique.set(id, {
      id: `imported-${id}`,
      title: String(item.name ?? item.title ?? item.summary ?? mainT().main.importedChat).trim() || mainT().main.importedChat,
      messages,
      ...isoDate(item.updated_at ?? item.created_at),
      source
    });
  }
  // Some exports contain a single conversation object rather than a list.
  if (!unique.size) {
    const messages = extractMessages(data);
    if (messages.length) unique.set("single", { id: "imported-single", title: String(data.name ?? data.title ?? mainT().main.importedChat), messages, source });
  }
  return [...unique.values()];
}


ipcMain.handle("dialog:export-chat", async (_event, payload: { fileName: string; data: string; format?: "json" | "html" }) => {
  const ext = payload?.format === "html" ? "html" : "json";
  const safeName = String(payload?.fileName ?? "claude-conversation").replace(/[\\\\/:*?"<>|]/g, "_").slice(0, 100) || "claude-conversation";
  const result = await dialog.showSaveDialog({
    title: ext === "html" ? mainT().main.exportHtmlTitle : mainT().main.exportJsonTitle,
    defaultPath: safeName.endsWith("." + ext) ? safeName : safeName + "." + ext,
    filters: [ext === "html" ? { name: "HTML", extensions: ["html"] } : { name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, String(payload?.data ?? ""), "utf8");
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle("dialog:import-export", async () => {
  const result = await dialog.showOpenDialog({
    title: mainT().main.importTitle, properties: ["openFile"],
    filters: [{ name: "Claude export (JSON / ZIP)", extensions: ["json", "zip"] }, { name: mainT().main.allFiles, extensions: ["*"] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  let imported: NormalizedConversation[] = [];
  if (path.extname(filePath).toLowerCase() === ".zip") {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries().filter(entry => !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".json"));
    for (const entry of entries) {
      if (entry.header.size > 25 * 1024 * 1024) continue;
      imported.push(...parseExportText(entry.getData().toString("utf8"), entry.entryName));
    }
  } else {
    const stat = await fs.stat(filePath);
    if (stat.size > 50 * 1024 * 1024) throw new Error(mainT().main.jsonTooLarge);
    imported = parseExportText(await fs.readFile(filePath, "utf8"), fileName);
  }
  return { fileName, conversations: imported, count: imported.length };
});


const chatsFile = () => path.join(dataDir(), "chats.json");
ipcMain.handle("chats:load", async () => {
  try { const data = JSON.parse(await fs.readFile(chatsFile(), "utf8")); return Array.isArray(data) ? data : []; }
  catch { return []; }
});
const str = (v: unknown, max: number) => typeof v === "string" ? v.slice(0, max) : undefined;
function sanitizeAttachment(a: any): Attachment | null {
  if (!a || typeof a.id !== "string" || !/^[0-9a-f-]{36}$/.test(a.id)) return null;
  const kind = ["image", "pdf", "text", "file"].includes(a.kind) ? a.kind : "file";
  return { id: a.id, name: str(a.name, 200) ?? "file", mediaType: str(a.mediaType, 120) ?? "application/octet-stream", size: Number(a.size) || 0, kind };
}
const sanitizeAttachments = (list: unknown) => Array.isArray(list) ? list.slice(0, 50).map(sanitizeAttachment).filter((a): a is Attachment => a !== null) : undefined;
function sanitizeReply(m: any) {
  return {
    content: String(m.content ?? "").slice(0, 2_000_000),
    ...(typeof m.thinking === "string" && m.thinking ? { thinking: m.thinking.slice(0, 500_000) } : {}),
    ...(typeof m.thinkingSeconds === "number" && Number.isFinite(m.thinkingSeconds) ? { thinkingSeconds: Math.max(0, m.thinkingSeconds) } : {}),
    ...(typeof m.model === "string" ? { model: m.model.slice(0, 200) } : {}),
    ...(typeof m.costUsd === "number" && Number.isFinite(m.costUsd) ? { costUsd: m.costUsd } : {}),
    ...(m.aborted === true ? { aborted: true } : {}),
    ...(typeof m.stopReason === "string" ? { stopReason: m.stopReason.slice(0, 40) } : {}),
    ...(Array.isArray(m.steps) ? { steps: m.steps.slice(0, 100).map((st: any) => ({
      kind: ["search", "fetch", "code", "file", "memory", "history", "connector", "other"].includes(st?.kind) ? st.kind : "other", label: str(st?.label, 500) ?? "",
      ...(st?.detail ? { detail: str(st.detail, 5000) } : {}), ...(st?.output ? { output: str(st.output, 5000) } : {}), ...(st?.error === true ? { error: true } : {}),
      ...(Array.isArray(st?.sources) ? { sources: st.sources.slice(0, 20).map((c: any) => ({ url: str(c?.url, 2000) ?? "", title: str(c?.title, 500) ?? "" })) } : {})
    })) } : {}),
    ...(Array.isArray(m.citations) ? { citations: m.citations.slice(0, 100).map((c: any) => ({ url: str(c?.url, 2000) ?? "", title: str(c?.title, 500) ?? "", ...(c?.citedText ? { citedText: str(c.citedText, 1000) } : {}) })) } : {}),
    ...(Array.isArray(m.files) ? { files: m.files.slice(0, 50).map((f: any) => ({ fileId: str(f?.fileId, 200) ?? "", name: str(f?.name, 300) ?? "file", ...(typeof f?.size === "number" ? { size: f.size } : {}) })) } : {})
  };
}
/** Edited user turns keep earlier versions with the replies that followed them; nesting is capped. */
function sanitizeMessage(m: any, depth: number): any {
  const role = m?.role === "assistant" ? "assistant" : "user";
  const attachments = role === "user" ? sanitizeAttachments(m?.attachments) : undefined;
  return {
    role, ...sanitizeReply(m ?? {}),
    ...(attachments?.length ? { attachments } : {}),
    ...(role === "assistant" && Array.isArray(m.alternates) ? { alternates: m.alternates.slice(0, 20).map(sanitizeReply), altIndex: Number(m.altIndex) || 0 } : {}),
    ...(role === "user" && Array.isArray(m.versions) && m.versions.length > 1 && depth < 4 ? {
      versions: m.versions.slice(0, 20).map((v: any) => {
        const va = sanitizeAttachments(v?.attachments);
        return { content: str(v?.content, 2_000_000) ?? "", ...(va?.length ? { attachments: va } : {}), tail: Array.isArray(v?.tail) ? v.tail.slice(0, 2000).map((t: any) => sanitizeMessage(t, depth + 1)) : [] };
      }),
      versionIndex: Math.max(0, Math.min(Number(m.versionIndex) || 0, m.versions.length - 1))
    } : {})
  };
}
ipcMain.handle("chats:save", async (_event, chats: unknown[]) => {
  if (!Array.isArray(chats)) throw new Error(mainT().main.badChats);
  const safeChats = chats.map((chat: any) => ({
    id: String(chat.id ?? ""),
    title: String(chat.title ?? mainT().main.chat).slice(0, 300),
    source: typeof chat.source === "string" ? chat.source.slice(0, 1000) : undefined,
    ...(typeof chat.projectId === "string" ? { projectId: chat.projectId.slice(0, 100) } : {}),
    ...(chat.starred === true ? { starred: true } : {}),
    ...isoDate(chat.updatedAt),
    ...(typeof chat.style === "string" ? { style: chat.style.slice(0, 60) } : {}),
    ...(chat.tools && typeof chat.tools === "object" ? { tools: {
      ...Object.fromEntries(["research", "webSearch", "webFetch", "files", "analysis", "memory"].map(k => [k, chat.tools[k] === true])),
      ...(Array.isArray(chat.tools.connectors) ? { connectors: chat.tools.connectors.filter((c: unknown) => typeof c === "string").slice(0, 30).map((c: string) => c.slice(0, 40)) } : {})
    } } : {}),
    ...(chat.container && typeof chat.container.id === "string" ? { container: { id: chat.container.id.slice(0, 200), expiresAt: str(chat.container.expiresAt, 60) } } : {}),
    messages: Array.isArray(chat.messages) ? chat.messages.slice(-5000).map((m: any) => sanitizeMessage(m, 0)) : []
  }));
  await fs.writeFile(chatsFile(), JSON.stringify(safeChats), "utf8");
  return true;
});


const usageFile = () => path.join(dataDir(), "usage.json");
ipcMain.handle("usage:load", async () => {
  let rows: any[] = [];
  try { const data = JSON.parse(await fs.readFile(usageFile(), "utf8")); if (Array.isArray(data)) rows = data; } catch {}
  // Usage recorded by the bundled MCP server (append-only JSON lines) counts toward the same credit.
  try {
    const lines = (await fs.readFile(path.join(dataDir(), "usage-mcp.jsonl"), "utf8")).split("\n").filter(Boolean);
    for (const line of lines) { try { rows.push({ ...JSON.parse(line), source: "mcp" }); } catch {} }
  } catch {}
  return rows;
});
// ---- Backup and restore of everything except the device-bound API key ----
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
ipcMain.handle("data:backup", async () => {
  const result = await dialog.showSaveDialog({
    title: mainT().main.backupTitle, defaultPath: `claude-continuity-backup-${stamp()}.zip`,
    filters: [{ name: "ZIP", extensions: ["zip"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const { zip, count } = await createBackup(dataDir(), app.getVersion());
  await fs.writeFile(result.filePath, zip.toBuffer());
  return { canceled: false, filePath: result.filePath, count };
});
ipcMain.handle("window:focus", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
  return true;
});
ipcMain.handle("data:openFolder", async () => {
  const error = await shell.openPath(dataDir());
  if (error) throw new Error(error);
  return true;
});
ipcMain.handle("data:restore", async () => {
  const result = await dialog.showOpenDialog({ title: mainT().main.restoreTitle, properties: ["openFile"], filters: [{ name: "ZIP", extensions: ["zip"] }] });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const stat = await fs.stat(result.filePaths[0]);
  if (stat.size > 2 * 1024 * 1024 * 1024) throw new Error(mainT().main.backupFileTooLarge);
  let zip: AdmZip;
  try { zip = new AdmZip(result.filePaths[0]); } catch { throw new Error(mainT().main.zipOpenFailed); }
  const entries = readBackup(zip);
  // Keep the current state next to the data folder so a mistaken restore can be undone by restoring this file.
  const safetyDir = path.join(app.getPath("userData"), "backups");
  await fs.mkdir(safetyDir, { recursive: true });
  const safetyPath = path.join(safetyDir, `before-restore-${stamp()}.zip`);
  await fs.writeFile(safetyPath, (await createBackup(dataDir(), app.getVersion())).zip.toBuffer());
  await restoreEntries(dataDir(), entries);
  const restoredPrefs = await loadPrefs();
  nativeTheme.themeSource = restoredPrefs.theme;
  applyLanguage(restoredPrefs.language);
  return { canceled: false, count: entries.length, safetyPath };
});
ipcMain.handle("mcp:info", () => {
  // Packaged builds unpack dist-mcp from the asar archive so the Electron binary can run it as Node.
  const appPath = app.getAppPath();
  const base = app.isPackaged ? appPath.replace(/app\.asar$/, "app.asar.unpacked") : appPath;
  return { serverPath: path.join(base, "dist-mcp", "server.js"), runtimePath: process.execPath, dataDir: dataDir(), platform: process.platform };
});
ipcMain.handle("mcp:pickFolder", async () => {
  const result = await dialog.showOpenDialog({ title: mainT().main.mcpFolderTitle, properties: ["openDirectory", "multiSelections"] });
  return result.canceled ? [] : result.filePaths;
});
type UsageEntry = { model: string; inputTokens: number; outputTokens: number; cacheCreationInputTokens: number; cacheReadInputTokens: number; webSearchRequests: number };
async function recordUsage(entry: UsageEntry) {
  let rows: any[] = [];
  try { const raw = JSON.parse(await fs.readFile(usageFile(), "utf8")); if (Array.isArray(raw)) rows = raw; } catch {}
  rows.push({ ...entry, sessionId, createdAt: new Date().toISOString() });
  // Retain a bounded local ledger instead of allowing indefinite growth.
  await fs.writeFile(usageFile(), JSON.stringify(rows.slice(-10000)), "utf8");
}
ipcMain.handle("key:save", async (_event, apiKey: string) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error(mainT().main.keyStorageUnavailable);
  if (!apiKey || !apiKey.startsWith("sk-ant-")) throw new Error(mainT().main.badKey);
  await fs.writeFile(keyFile(), safeStorage.encryptString(apiKey)); return true;
});
ipcMain.handle("key:status", async () => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return { configured: false, secureStorage: false };
    const encrypted = await fs.readFile(keyFile());
    return { configured: encrypted.length > 0, secureStorage: true };
  } catch { return { configured: false, secureStorage: safeStorage.isEncryptionAvailable() }; }
});
async function getApiKey() {
  if (!safeStorage.isEncryptionAvailable()) throw new Error(mainT().main.secureStorageUnavailable);
  return safeStorage.decryptString(await fs.readFile(keyFile()));
}
type ModelSummary = {
  id: string; displayName: string; createdAt?: string;
  maxTokens?: number; maxInputTokens?: number; effortLevels: string[]; adaptiveThinking: boolean;
  webSearch: boolean; codeExecution: boolean; imageInput: boolean; pdfInput: boolean;
};
const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"];
// Read capability fields defensively: older models or proxies may omit them.
function summarizeModel(model: any): ModelSummary {
  const caps = model?.capabilities ?? {};
  const known = model?.capabilities != null;
  return {
    id: String(model.id),
    displayName: model.display_name || String(model.id),
    createdAt: model.created_at,
    maxTokens: typeof model.max_tokens === "number" && model.max_tokens > 0 ? model.max_tokens : undefined,
    maxInputTokens: typeof model.max_input_tokens === "number" && model.max_input_tokens > 0 ? model.max_input_tokens : undefined,
    effortLevels: caps.effort?.supported ? EFFORT_LEVELS.filter(level => caps.effort?.[level]?.supported) : [],
    adaptiveThinking: caps.thinking?.types?.adaptive?.supported === true,
    // When capabilities are missing, assume support and let the API report errors.
    webSearch: known ? caps.server_tools?.web_search?.supported === true : true,
    codeExecution: known ? caps.server_tools?.code_execution?.supported === true : true,
    imageInput: known ? caps.image_input?.supported !== false : true,
    pdfInput: known ? caps.pdf_input?.supported !== false : true
  };
}
const modelCache = new Map<string, ModelSummary>();
async function listModels(apiKey: string): Promise<ModelSummary[]> {
  // Follow every page so the selector shows all models the key can access.
  const client = new Anthropic({ apiKey });
  const models: ModelSummary[] = [];
  for await (const model of client.models.list({ limit: 1000 })) models.push(summarizeModel(model));
  return models;
}
ipcMain.handle("claude:models", async () => {
  const models = await listModels(await getApiKey());
  modelCache.clear();
  for (const model of models) modelCache.set(model.id, model);
  return models;
});
ipcMain.handle("key:test", async (_event, apiKey: string) => {
  if (!apiKey || !apiKey.startsWith("sk-ant-")) throw new Error(mainT().main.badKeyPrefix);
  const models = await listModels(apiKey);
  return { ok: true, modelCount: models.length };
});

const creditFile = () => path.join(dataDir(), "credit.json");
const PLANS = ["max5x", "max20x", "team", "custom", "none"];
ipcMain.handle("credit:load", async () => {
  try { return JSON.parse(await fs.readFile(creditFile(), "utf8")); } catch { return null; }
});
ipcMain.handle("credit:save", async (_event, value: any) => {
  if (!value || typeof value !== "object") throw new Error(mainT().main.badCredit);
  const plan = value.plan == null ? null : String(value.plan);
  if (plan !== null && !PLANS.includes(plan)) throw new Error(mainT().main.badPlan);
  const amount = Number(value.monthlyAmountUsd ?? 0);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10000) throw new Error(mainT().main.badAmount);
  const resetDay = Math.round(Number(value.resetDay ?? 1));
  if (!(resetDay >= 1 && resetDay <= 31)) throw new Error(mainT().main.badResetDay);
  let calibration: { balanceUsd: number; observedAt: string } | undefined;
  if (value.calibration) {
    const balanceUsd = Number(value.calibration.balanceUsd);
    const observedAt = new Date(String(value.calibration.observedAt));
    if (!Number.isFinite(balanceUsd) || balanceUsd < 0 || Number.isNaN(observedAt.getTime())) throw new Error(mainT().main.badCalibration);
    calibration = { balanceUsd, observedAt: observedAt.toISOString() };
  }
  const saved = { plan, monthlyAmountUsd: amount, resetDay, onboardingDone: value.onboardingDone === true, ...(calibration ? { calibration } : {}) };
  await fs.writeFile(creditFile(), JSON.stringify(saved), "utf8");
  return saved;
});

// ---- Preferences and projects ----
const prefsFile = () => path.join(dataDir(), "prefs.json");
type Theme = "system" | "light" | "dark";
type ChatFont = "serif" | "sans" | "system";
type CustomStyle = { id: string; name: string; prompt: string };
type Prefs = { autoTitle: boolean; customStyle: string; customStyles: CustomStyle[]; displayName: string; theme: Theme; chatFont: ChatFont; shareName: boolean; preferences: string; searchPastChats: boolean; notifyOnReply: boolean; checkUpdates: boolean; language: Language };
type Language = "system" | "ja" | "en";
const THEMES: Theme[] = ["system", "light", "dark"];
const LANGUAGES: Language[] = ["system", "ja", "en"];
const FONTS: ChatFont[] = ["serif", "sans", "system"];
function sanitizeStyles(raw: any): CustomStyle[] {
  if (Array.isArray(raw?.customStyles)) {
    return raw.customStyles.slice(0, 20).map((st: any, i: number) => ({
      id: String(st?.id ?? `s${i}`).replace(/[^\w-]/g, "").slice(0, 40) || `s${i}`,
      name: String(st?.name ?? "").trim().slice(0, 40) || mainT().main.styleName(i + 1),
      prompt: String(st?.prompt ?? "").slice(0, 4000)
    })).filter((st: CustomStyle) => st.prompt.trim());
  }
  // Earlier versions kept a single custom style; carry it over as "カスタム" (its chats used style "custom").
  return typeof raw?.customStyle === "string" && raw.customStyle.trim() ? [{ id: "custom", name: mainT().main.customStyleName, prompt: raw.customStyle.slice(0, 4000) }] : [];
}
function sanitizePrefs(raw: any): Prefs {
  return {
    autoTitle: raw?.autoTitle !== false,
    customStyle: typeof raw?.customStyle === "string" ? raw.customStyle.slice(0, 4000) : "",
    customStyles: sanitizeStyles(raw),
    displayName: typeof raw?.displayName === "string" ? raw.displayName.trim().slice(0, 40) : "",
    theme: THEMES.includes(raw?.theme) ? raw.theme : "dark",
    chatFont: FONTS.includes(raw?.chatFont) ? raw.chatFont : "serif",
    // The display name stays local unless the user opts in to Claude using it.
    shareName: raw?.shareName === true,
    preferences: typeof raw?.preferences === "string" ? raw.preferences.slice(0, 4000) : "",
    searchPastChats: raw?.searchPastChats !== false,
    notifyOnReply: raw?.notifyOnReply !== false,
    checkUpdates: raw?.checkUpdates !== false,
    language: LANGUAGES.includes(raw?.language) ? raw.language : "system"
  };
}
async function loadPrefs(): Promise<Prefs> {
  try { return sanitizePrefs(JSON.parse(await fs.readFile(prefsFile(), "utf8"))); }
  catch { return sanitizePrefs({}); }
}
/** Main-process strings follow the language preference; "system" uses the OS locale. */
function applyLanguage(language: Language) {
  setMainLocale(resolveMainLocale(language, app.getLocale()));
}
ipcMain.handle("prefs:load", () => loadPrefs());
ipcMain.handle("prefs:save", async (_event, value: unknown) => {
  const prefs = sanitizePrefs(value);
  await fs.writeFile(prefsFile(), JSON.stringify(prefs), "utf8");
  nativeTheme.themeSource = prefs.theme;
  applyLanguage(prefs.language);
  return prefs;
});
const projectsFile = () => path.join(dataDir(), "projects.json");
async function loadProjects(): Promise<Project[]> {
  try {
    const raw = JSON.parse(await fs.readFile(projectsFile(), "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}
ipcMain.handle("projects:load", () => loadProjects());
ipcMain.handle("projects:save", async (_event, list: unknown) => {
  if (!Array.isArray(list)) throw new Error(mainT().main.badProjects);
  const projects: Project[] = list.slice(0, 200).map((p: any) => ({
    id: String(p?.id ?? randomUUID()).slice(0, 100),
    name: String(p?.name ?? mainT().main.project).slice(0, 100) || mainT().main.project,
    instructions: String(p?.instructions ?? "").slice(0, 20_000),
    knowledge: sanitizeAttachments(p?.knowledge) ?? [],
    memory: p?.memory === true
  }));
  await fs.writeFile(projectsFile(), JSON.stringify(projects), "utf8");
  return projects;
});

// ---- Attachments ----
const attachments = () => new AttachmentStore(path.join(dataDir(), "attachments"));
ipcMain.handle("attachments:pick", async () => {
  const result = await dialog.showOpenDialog({ title: mainT().main.attachTitle, properties: ["openFile", "multiSelections"] });
  if (result.canceled) return { added: [], errors: [] };
  return addAttachmentPaths(result.filePaths);
});
async function addAttachmentPaths(paths: string[]) {
  const added: Attachment[] = [];
  const errors: string[] = [];
  for (const p of paths.slice(0, 20)) {
    try { added.push(await attachments().addPath(String(p))); }
    catch (e) { errors.push(e instanceof Error ? e.message : String(e)); }
  }
  return { added, errors };
}
ipcMain.handle("attachments:addPaths", (_event, paths: unknown) => addAttachmentPaths(Array.isArray(paths) ? paths.map(String) : []));
ipcMain.handle("attachments:addData", async (_event, payload: { name: string; data: Uint8Array }) => {
  try { return { added: [await attachments().add(String(payload?.name ?? "pasted.png"), Buffer.from(payload.data))], errors: [] }; }
  catch (e) { return { added: [], errors: [e instanceof Error ? e.message : String(e)] }; }
});
ipcMain.handle("attachments:preview", async (_event, id: string) => {
  // Small data URL for image thumbnails in the composer and history.
  const buffer = await attachments().read(String(id));
  if (buffer.length > 10 * 1024 * 1024) return null;
  const head = buffer.subarray(0, 12);
  const type = head[0] === 0x89 ? "image/png" : head[0] === 0xff ? "image/jpeg" : head.toString("latin1", 0, 3) === "GIF" ? "image/gif" : "image/webp";
  return `data:${type};base64,${buffer.toString("base64")}`;
});

ipcMain.handle("attachments:text", async (_event, id: string) => {
  // In-app viewer for text attachments; capped so a huge log does not freeze the window.
  const buffer = await attachments().read(String(id));
  const text = buffer.subarray(0, 400_000).toString("utf8");
  return { text: text.slice(0, 200_000), truncated: buffer.length > 400_000 || text.length > 200_000 };
});
ipcMain.handle("attachments:openPdf", async (_event, id: string, name: string) => {
  // Only real PDFs are handed to the OS viewer, under a forced .pdf name, so an attachment can never be executed.
  const buffer = await attachments().read(String(id));
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(mainT().main.notPdf);
  const safe = (path.basename(String(name ?? "document")).replace(/[^\p{L}\p{N} ._-]/gu, "_").replace(/\.pdf$/i, "").slice(0, 80) || "document") + ".pdf";
  const dir = path.join(app.getPath("temp"), "claude-continuity-view", String(id).replace(/[^\w-]/g, "").slice(0, 64));
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, safe);
  await fs.writeFile(target, buffer);
  const error = await shell.openPath(target);
  if (error) throw new Error(error);
  return true;
});

// ---- Memory ----
const memoryRoot = () => path.join(dataDir(), "memories");
ipcMain.handle("memory:list", () => listMemoryFiles(memoryRoot()));
ipcMain.handle("memory:delete", async (_event, virtualPath: string) => {
  const result = await runMemoryCommand(memoryRoot(), { command: "delete", path: String(virtualPath) });
  if (result.isError) throw new Error(result.content);
  return true;
});

ipcMain.handle("memory:write", async (_event, virtualPath: string, text: string) => {
  // Same path rules as Claude's memory tool: only under /memories, no traversal or symlinks.
  const result = await runMemoryCommand(memoryRoot(), { command: "create", path: String(virtualPath), file_text: String(text ?? "") });
  if (result.isError) throw new Error(result.content);
  return true;
});

// ---- Connectors (remote MCP servers via the API's MCP connector, local stdio servers run here) ----
const connectorsFile = () => path.join(dataDir(), "connectors.json");
type StoredConnector = {
  id: string; name: string; enabled?: boolean; transport?: "remote" | "local";
  url?: string; tokenEnc?: string;
  command?: string; args?: string[]; envEnc?: string; envKeys?: string[]; allowedTools?: string[];
};
const isLocal = (c: { transport?: string }) => c.transport === "local";
async function readStoredConnectors(): Promise<StoredConnector[]> {
  try {
    const raw = JSON.parse(await fs.readFile(connectorsFile(), "utf8"));
    return Array.isArray(raw) ? raw.filter((c: any) => c && typeof c.id === "string" && (isLocal(c) ? typeof c.command === "string" : typeof c.url === "string")).slice(0, 30) : [];
  } catch { return []; }
}
const writeStoredConnectors = (list: StoredConnector[]) => fs.writeFile(connectorsFile(), JSON.stringify(list), "utf8");
const decrypt = (value?: string) => {
  try { if (value && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(value, "base64")); } catch {}
  return undefined;
};
const encrypt = (value: string, unavailable: string) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error(unavailable);
  return safeStorage.encryptString(value).toString("base64");
};
/** Tokens and environment variables are encrypted with the OS key store like the API key and only decrypted when needed. */
async function loadConnectors(): Promise<Connector[]> {
  return (await readStoredConnectors()).map(c => {
    const token = decrypt(c.tokenEnc);
    let env: Record<string, string> = {};
    try { env = c.envEnc ? JSON.parse(decrypt(c.envEnc) ?? "{}") : {}; } catch {}
    return {
      id: c.id, name: String(c.name ?? ""), enabled: c.enabled !== false, transport: isLocal(c) ? "local" as const : "remote" as const,
      url: c.url ?? "", ...(token ? { token } : {}),
      ...(isLocal(c) ? { command: c.command, args: Array.isArray(c.args) ? c.args.map(String) : [], env, allowedTools: c.allowedTools ?? [] } : {})
    };
  });
}
const viewOf = (c: StoredConnector): ConnectorView => ({
  id: c.id, name: String(c.name ?? ""), enabled: c.enabled !== false, transport: isLocal(c) ? "local" : "remote", url: c.url ?? "", hasToken: !!c.tokenEnc,
  ...(isLocal(c) ? { command: c.command, args: c.args ?? [], envKeys: c.envKeys ?? [], allowedTools: c.allowedTools ?? [] } : {})
});
ipcMain.handle("connectors:list", async () => (await readStoredConnectors()).map(viewOf));
type ConnectorInput = { id?: string; name: string; enabled?: boolean; transport?: "remote" | "local"; url?: string; token?: string | null; command?: string; args?: string | string[]; env?: string | null };
ipcMain.handle("connectors:save", async (_event, input: ConnectorInput) => {
  const list = await readStoredConnectors();
  const id = typeof input?.id === "string" && list.some(c => c.id === input.id) ? input.id : randomUUID().replace(/-/g, "").slice(0, 12);
  const previous = list.find(c => c.id === id);
  let next: StoredConnector;
  if (input?.transport === "local") {
    const { name, command, args } = validateLocal(input);
    let { envEnc, envKeys } = previous ?? {};
    // undefined keeps the saved variables, "" or null clears them, any other string replaces them.
    if (input.env === "" || input.env === null) { envEnc = undefined; envKeys = undefined; }
    else if (typeof input.env === "string") {
      const env = parseEnv(input.env);
      envKeys = Object.keys(env);
      envEnc = envKeys.length ? encrypt(JSON.stringify(env), mainT().localMcp.envStorageUnavailable) : undefined;
    }
    // A changed command may be a different program: forget its "always allow" choices.
    const same = previous && isLocal(previous) && previous.command === command && JSON.stringify(previous.args ?? []) === JSON.stringify(args);
    next = { id, name, enabled: input.enabled !== false, transport: "local", command, args, ...(envEnc ? { envEnc, envKeys } : {}), ...(same && previous?.allowedTools?.length ? { allowedTools: previous.allowedTools } : {}) };
    await localPool.close(id);
  } else {
    const { name, url } = validateConnector({ name: input?.name, url: input?.url });
    let tokenEnc = previous?.tokenEnc;
    // undefined keeps the saved token, "" or null clears it, any other string replaces it.
    if (input?.token === "" || input?.token === null) tokenEnc = undefined;
    else if (typeof input?.token === "string") tokenEnc = encrypt(input.token.trim().slice(0, 8000), mainT().connectors.tokenStorageUnavailable);
    next = { id, name, url, enabled: input?.enabled !== false, ...(tokenEnc ? { tokenEnc } : {}) };
  }
  const saved = previous ? list.map(c => c.id === id ? next : c) : [...list, next];
  await writeStoredConnectors(saved);
  return saved.map(viewOf);
});
/** Adds the stdio servers from Claude Desktop's config that are not registered yet (same name and command). */
ipcMain.handle("connectors:importDesktop", async () => {
  const file = desktopConfigPath(process.platform, process.env, app.getPath("home"));
  let raw: string;
  try { raw = await fs.readFile(file, "utf8"); } catch { throw new Error(mainT().localMcp.configNotFound(file)); }
  let servers;
  try { servers = parseDesktopConfig(JSON.parse(raw)); } catch { throw new Error(mainT().localMcp.configInvalid); }
  const list = await readStoredConnectors();
  let added = 0;
  for (const server of servers) {
    if (list.length >= 30) break;
    if (list.some(c => isLocal(c) && c.name === server.name && c.command === server.command)) continue;
    const envKeys = Object.keys(server.env);
    list.push({ id: randomUUID().replace(/-/g, "").slice(0, 12), name: server.name, enabled: true, transport: "local", command: server.command, args: server.args,
      ...(envKeys.length ? { envEnc: encrypt(JSON.stringify(server.env), mainT().localMcp.envStorageUnavailable), envKeys } : {}) });
    added++;
  }
  await writeStoredConnectors(list);
  return { list: list.map(viewOf), added, found: servers.length, file };
});
ipcMain.handle("connectors:delete", async (_event, id: string) => {
  const saved = (await readStoredConnectors()).filter(c => c.id !== String(id));
  await writeStoredConnectors(saved);
  await localPool.close(String(id));
  return saved.map(viewOf);
});
ipcMain.handle("connectors:test", async (_event, id: string) => {
  // Lists the server's tools from this PC to confirm the URL and token; the API itself connects from Anthropic's side.
  const connector = (await loadConnectors()).find(c => c.id === String(id));
  if (!connector) throw new Error(mainT().connectors.notFound);
  if (connector.transport === "local") {
    await localPool.close(connector.id);
    return { tools: (await localPool.tools(localServer(connector))).map(t => t.name) };
  }
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const { SSEClientTransport } = await import("@modelcontextprotocol/sdk/client/sse.js");
  const headers: Record<string, string> = connector.token ? { Authorization: `Bearer ${connector.token}` } : {};
  const attempt = async (transport: any) => {
    const client = new Client({ name: "claude-continuity", version: app.getVersion() });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      return tools.map(t => t.name).slice(0, 100);
    } finally { await client.close().catch(() => {}); }
  };
  try { return { tools: await attempt(new StreamableHTTPClientTransport(new URL(connector.url), { requestInit: { headers } })) }; }
  catch (first) {
    try { return { tools: await attempt(new SSEClientTransport(new URL(connector.url), { requestInit: { headers }, eventSourceInit: { fetch: (u: any, init: any) => fetch(u, { ...init, headers: { ...(init?.headers ?? {}), ...headers } }) } as any })) }; }
    catch { throw new Error(mainT().connectors.connectFailed(String((first as Error)?.message ?? first).slice(0, 200))); }
  }
});

// ---- Generated files ----
ipcMain.handle("files:save", async (_event, payload: { fileId: string; name: string }) => {
  const fileId = String(payload?.fileId ?? "");
  if (!/^file_[A-Za-z0-9_-]+$/.test(fileId)) throw new Error(mainT().main.badFileId);
  const result = await dialog.showSaveDialog({ title: mainT().main.saveFileTitle, defaultPath: String(payload?.name ?? "output").replace(/[\\/:*?"<>|]/g, "_").slice(0, 150) });
  if (result.canceled || !result.filePath) return { canceled: true };
  const client = new Anthropic({ apiKey: await getApiKey() });
  const response = await client.files.download(fileId);
  await fs.writeFile(result.filePath, Buffer.from(await response.arrayBuffer()));
  return { canceled: false, filePath: result.filePath };
});

// ---- Replies ----
type ReplyPayload = {
  requestId: string; messages: ChatTurn[]; model?: string; effort?: string;
  style?: string; projectId?: string; tools?: ToolFlags; containerId?: string; chatId?: string; incognito?: boolean;
};
const activeReplies = new Map<string, AbortController>();
const MAX_LOOP = 8;
// Research runs many server-tool rounds; each pause_turn continues the same answer.
const RESEARCH_MAX_LOOP = 24;
ipcMain.handle("claude:abort", (_event, requestId: string) => {
  activeReplies.get(String(requestId))?.abort();
  return true;
});
function sanitizeTurns(list: unknown): ChatTurn[] {
  if (!Array.isArray(list)) return [];
  return list.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2_000_000), ...(m.role === "user" ? { attachments: sanitizeAttachments(m.attachments) } : {}) }));
}
// ---- Approval for local MCP tools (asked in the chat, like Claude Desktop) ----
const approvals = new Map<string, (decision: ApprovalDecision) => void>();
type ApprovalDecision = "once" | "always" | "deny";
function requestApproval(sender: Electron.WebContents, requestId: string, ref: LocalToolRef, input: unknown, signal: AbortSignal): Promise<ApprovalDecision> {
  return new Promise(resolve => {
    const approvalId = randomUUID();
    const done = (decision: ApprovalDecision) => { approvals.delete(approvalId); signal.removeEventListener("abort", onAbort); resolve(decision); };
    const onAbort = () => done("deny");
    approvals.set(approvalId, done);
    signal.addEventListener("abort", onAbort);
    if (sender.isDestroyed()) return done("deny");
    const shown = JSON.stringify(input ?? {}, null, 2);
    sender.send("claude:approval", { requestId, approvalId, server: ref.serverName, tool: ref.tool, input: shown.length > 4000 ? shown.slice(0, 4000) + "…" : shown });
  });
}
ipcMain.handle("claude:approve", (_event, approvalId: string, decision: string) => {
  const answer = approvals.get(String(approvalId));
  answer?.(decision === "once" || decision === "always" ? decision : "deny");
  return !!answer;
});
async function rememberAllowedTool(id: string, tool: string) {
  const list = await readStoredConnectors();
  await writeStoredConnectors(list.map(c => c.id === id ? { ...c, allowedTools: [...new Set([...(c.allowedTools ?? []), tool])].slice(0, 200) } : c));
}
ipcMain.handle("connectors:resetAllowed", async (_event, id: string) => {
  const list = (await readStoredConnectors()).map(c => c.id === String(id) ? { ...c, allowedTools: [] } : c);
  await writeStoredConnectors(list);
  return list.map(viewOf);
});

async function pastChatsOutcome(input: { query?: unknown; max_results?: unknown }, chatId?: string, projectId?: string) {
  const query = typeof input?.query === "string" ? input.query.slice(0, 500) : "";
  if (!query.trim()) return { content: "Error: query is required", isError: true };
  let chats: any[] = [];
  try { const data = JSON.parse(await fs.readFile(chatsFile(), "utf8")); if (Array.isArray(data)) chats = data; } catch {}
  const max = typeof input?.max_results === "number" ? input.max_results : 5;
  return { content: formatHits(searchPastChats(chats, query, { excludeId: chatId, projectId: projectId || undefined, max })) };
}
ipcMain.handle("claude:reply", async (event, payload: ReplyPayload) => {
  const turns = sanitizeTurns(payload?.messages);
  if (!turns.length) throw new Error(mainT().main.noTurns);
  if (!turns.some(m => m.role === "user")) throw new Error(mainT().main.noUserMessage);
  const requestId = String(payload.requestId ?? randomUUID());
  const model = payload.model || "claude-sonnet-4-5";
  const info = modelCache.get(model);
  const caps = { webSearch: info?.webSearch ?? true, codeExecution: info?.codeExecution ?? true, imageInput: info?.imageInput ?? true, pdfInput: info?.pdfInput ?? true };
  const effort = payload.effort && info?.effortLevels.includes(payload.effort) ? payload.effort : undefined;
  const [prefs, projects] = await Promise.all([loadPrefs(), loadProjects()]);
  const project = payload.projectId ? projects.find(p => p.id === payload.projectId) ?? null : null;
  const incognito = payload.incognito === true;
  // Incognito chats neither remember nor look back, as in the Claude apps.
  const flags: ToolFlags = { ...(payload.tools ?? {}), memory: !incognito && (payload.tools?.memory === true || project?.memory === true), pastChats: !incognito && prefs.searchPastChats };
  const { tools, skills, unavailable } = buildTools(flags, caps);
  const codeOn = tools.some(t => t.type === "code_execution_20250825");
  const chosenConnectors = incognito ? [] : (await loadConnectors()).filter(c => c.enabled && (payload.tools?.connectors ?? []).includes(c.id));
  const activeConnectors = chosenConnectors.filter(c => c.transport !== "local");
  const localConnectors = chosenConnectors.filter(c => c.transport === "local");
  const mcp = activeConnectors.length ? connectorRequest(activeConnectors) : null;
  const connectorNames = new Map(activeConnectors.map(c => [serverName(c), c.name] as const));
  const connectorLabel = (server?: string) => (server && connectorNames.get(server)) || server || mainT().main.externalTool;
  const client = new Anthropic({ apiKey: await getApiKey() });
  const store = attachments();
  const loader = {
    read: (a: Attachment) => store.read(a.id),
    uploadForContainer: async (a: Attachment) => {
      const cached = await store.fileId(a.id);
      if (cached) return cached;
      const { toFile } = await import("@anthropic-ai/sdk");
      const uploaded = await client.files.upload({ file: await toFile(await store.read(a.id), a.name, { type: a.mediaType }) });
      await store.setFileId(a.id, uploaded.id);
      return uploaded.id;
    }
  };
  const built = await buildMessages(turns, project?.knowledge ?? [], loader, { containerUploads: codeOn, caps, maxChars: historyBudget(info?.maxInputTokens) });
  const messages: MessageParam[] = built.messages;
  // Custom styles are chosen as "custom:<id>"; the bare "custom" of earlier versions maps to id "custom".
  const customId = payload.style === "custom" ? "custom" : payload.style?.startsWith("custom:") ? payload.style.slice(7) : null;
  const customPrompt = customId ? prefs.customStyles.find(st => st.id === customId)?.prompt ?? "" : "";
  const style = (customId ? "custom" : payload.style) as StyleId | undefined;
  const research = flags.research === true;
  const system = buildSystem(style, customPrompt, project, { ...(prefs.shareName ? { name: prefs.displayName } : {}), preferences: prefs.preferences }, { research });
  const containerId = typeof payload.containerId === "string" && payload.containerId ? payload.containerId : undefined;

  const controller = new AbortController();
  activeReplies.set(requestId, controller);
  const send = (kind: "text" | "thinking" | "activity", delta: string) => {
    if (!event.sender.isDestroyed()) event.sender.send("claude:stream", { requestId, kind, delta });
  };
  // Local servers are started (or reused) before the first request so their tools can be offered.
  const localNotices: string[] = [];
  const localLists: { server: LocalServer; tools: Awaited<ReturnType<LocalMcpPool["tools"]>> }[] = [];
  for (const c of localConnectors) {
    send("activity", mainT().localMcp.starting(c.name));
    try { localLists.push({ server: localServer(c), tools: await localPool.tools(localServer(c)) }); }
    catch (error) { localNotices.push(mainT().localMcp.unavailable(c.name, String((error as Error)?.message ?? error).split("\n")[0].slice(0, 200))); }
  }
  const local = toolDefinitions(localLists);
  const runLocalTool = async (block: { id: string; name: string; input: unknown }, ref: LocalToolRef) => {
    const connector = localConnectors.find(c => c.id === ref.serverId)!;
    const allowed = (await readStoredConnectors()).find(c => c.id === ref.serverId)?.allowedTools ?? [];
    if (!allowed.includes(ref.tool)) {
      send("activity", mainT().localMcp.waitingApproval(ref.serverName, ref.tool));
      const decision = await requestApproval(event.sender, requestId, ref, block.input, controller.signal);
      if (decision === "deny") return { content: mainT().localMcp.denied, text: mainT().localMcp.denied, isError: true };
      if (decision === "always") await rememberAllowedTool(ref.serverId, ref.tool);
    }
    send("activity", mainT().localMcp.usingTool(ref.serverName, ref.tool));
    try {
      const result = toToolResult(await localPool.call(localServer(connector), ref.tool, block.input, controller.signal));
      return { content: result.content as any[], text: result.text, isError: result.isError };
    } catch (error) {
      if (controller.signal.aborted) throw error;
      const text = mainT().localMcp.callFailed(String((error as Error)?.message ?? error).slice(0, 500));
      return { content: text, text, isError: true };
    }
  };
  const totals = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0, searches: 0 };
  const progress = { searches: 0, fetches: 0 };
  const addUsage = (u: any) => {
    if (!u) return;
    totals.input += u.input_tokens ?? 0; totals.output += u.output_tokens ?? 0;
    totals.cacheCreate += u.cache_creation_input_tokens ?? 0; totals.cacheRead += u.cache_read_input_tokens ?? 0;
    totals.searches += u.server_tool_use?.web_search_requests ?? 0;
  };
  const turnBlocks: ContentBlock[] = [];
  let thinking = "";
  let aborted = false;
  let finalModel = model;
  let container: { id: string; expiresAt?: string } | undefined = containerId ? { id: containerId } : undefined;
  let pendingUsage: any = null;
  let stopReason: string | null = null;
  const clientResults = new Map<string, { content: string; isError?: boolean }>();
  try {
    for (let iteration = 0; iteration < (research ? RESEARCH_MAX_LOOP : MAX_LOOP); iteration++) {
      // Thinking counts toward max_tokens, so allow the model's full output budget; streaming keeps long replies within SDK limits.
      const params = {
        model, max_tokens: info?.maxTokens ?? 8192, messages,
        ...(system ? { system } : {}),
        ...(tools.length || mcp || local.tools.length ? { tools: [...tools, ...local.tools, ...(mcp?.tools ?? [])] } : {}),
        ...(mcp ? { mcp_servers: mcp.mcp_servers } : {}),
        ...(skills.length || container ? { container: { ...(container ? { id: container.id } : {}), ...(skills.length ? { skills: skills.map(skill_id => ({ type: "anthropic" as const, skill_id, version: "latest" })) } : {}) } } : {}),
        // Newer models default to display "omitted" (empty thinking text); ask for the readable summary instead.
        ...(info?.adaptiveThinking ? { thinking: { type: "adaptive" as const, display: "summarized" as const } } : {}),
        ...(effort ? { output_config: { effort: effort as "high" } } : {}),
        // Automatic prompt caching: the cache breakpoint moves forward with the conversation.
        cache_control: { type: "ephemeral" }
      };
      // Connectors need the MCP connector beta; everything else uses the regular endpoint.
      const stream = (mcp
        ? client.beta.messages.stream({ ...params, betas: [MCP_CONNECTOR_BETA] } as any, { signal: controller.signal })
        : client.messages.stream(params as any, { signal: controller.signal })) as unknown as MessageStream;
      stream.on("text", delta => send("text", delta));
      stream.on("thinking", delta => { thinking += delta; send("thinking", delta); });
      stream.on("streamEvent", (e, snapshot) => {
        pendingUsage = snapshot.usage;
        finalModel = snapshot.model || model;
        if (e.type === "content_block_start") {
          const block = e.content_block as { type: string; name?: string; server_name?: string };
          const ref = block.name ? local.refs.get(block.name) : undefined;
          if (research && block.type === "server_tool_use") { if (block.name === "web_search") progress.searches++; else if (block.name === "web_fetch") progress.fetches++; }
          const label = block.type === "mcp_tool_use" ? mainT().main.usingConnector(connectorLabel(block.server_name)) : ref ? mainT().localMcp.usingTool(ref.serverName, ref.tool)
            : research && block.type === "server_tool_use" && (block.name === "web_search" || block.name === "web_fetch") ? mainT().request.researchProgress(progress.searches, progress.fetches) : activityLabel(block.name);
          if (label && (block.type === "server_tool_use" || block.type === "tool_use" || block.type === "mcp_tool_use")) send("activity", label);
        }
      });
      const final: Message = await stream.finalMessage();
      addUsage(final.usage); pendingUsage = null;
      finalModel = final.model || model;
      // Separate text written before and after a tool round-trip, matching the "\n\n" streamed live.
      if (turnBlocks.some(b => b.type === "text") && final.content.some(b => b.type === "text")) turnBlocks.push({ type: "text", text: "\n\n", citations: null } as ContentBlock);
      turnBlocks.push(...final.content);
      if (final.container?.id) container = { id: final.container.id, expiresAt: final.container.expires_at };
      stopReason = final.stop_reason;
      if (final.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: final.content });
        continue;
      }
      if (final.stop_reason === "tool_use") {
        const results = [];
        for (const block of final.content) {
          if (block.type !== "tool_use") continue;
          const ref = local.refs.get(block.name);
          if (ref) {
            const outcome = await runLocalTool(block, ref);
            clientResults.set(block.id, { content: outcome.text, isError: outcome.isError });
            results.push({ type: "tool_result" as const, tool_use_id: block.id, content: outcome.content, ...(outcome.isError ? { is_error: true } : {}) });
            continue;
          }
          const outcome = block.name === "memory"
            ? await runMemoryCommand(memoryRoot(), (block.input ?? {}) as Record<string, unknown>)
            : block.name === "search_past_chats"
              ? await pastChatsOutcome(block.input as { query?: unknown; max_results?: unknown }, payload.chatId, payload.projectId)
              : { content: `Error: unknown tool ${block.name}`, isError: true };
          clientResults.set(block.id, outcome);
          results.push({ type: "tool_result" as const, tool_use_id: block.id, content: outcome.content, ...(outcome.isError ? { is_error: true } : {}) });
        }
        if (!results.length) break;
        messages.push({ role: "assistant", content: final.content }, { role: "user", content: results });
        send("text", "\n\n");
        continue;
      }
      break;
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
    aborted = true;
    // A stopped reply still consumed tokens; keep what the stream reported so far.
    addUsage(pendingUsage);
  } finally {
    activeReplies.delete(requestId);
  }
  const usage = {
    model: finalModel, inputTokens: totals.input, outputTokens: totals.output,
    cacheCreationInputTokens: totals.cacheCreate, cacheReadInputTokens: totals.cacheRead, webSearchRequests: totals.searches
  };
  if (usage.inputTokens || usage.outputTokens) await recordUsage(usage);
  const { text, citations } = extractText(turnBlocks);
  const files = [];
  for (const fileId of extractFileIds(turnBlocks)) {
    try {
      const meta = await client.files.retrieveMetadata(fileId);
      files.push({ fileId, name: meta.filename, size: meta.size_bytes });
    } catch { files.push({ fileId, name: fileId }); }
  }
  // "pause_turn"/"tool_use" here mean the loop limit cut the turn short; the UI offers to continue.
  const steps = extractSteps(turnBlocks, clientResults, Object.fromEntries(connectorNames), Object.fromEntries([...local.refs].map(([name, ref]) => [name, { server: ref.serverName, tool: ref.tool }])));
  return { text, thinking, aborted, usage, citations, files, container, steps, ...(stopReason && stopReason !== "end_turn" && stopReason !== "stop_sequence" && !aborted ? { stopReason } : {}), notices: [...localNotices, ...(built.omitted ? [mainT().main.noticeOmitted(built.omitted)] : []), ...built.skipped.map(s => mainT().main.noticeSkipped(s)), ...unavailable.map(u => mainT().main.noticeUnavailable(u))] };
});

// ---- Hand off to the Claude apps (claude://claude.ai/new?q=…, prefilled, never auto-sent) ----
ipcMain.handle("handoff:summarize", async (_event, payload: { model: string; title: string; transcript: string }) => {
  const model = String(payload?.model ?? "");
  const info = modelCache.get(model);
  const client = new Anthropic({ apiKey: await getApiKey() });
  // Keep the newest part when the record is long; the summary is about where things stand now.
  const transcript = String(payload?.transcript ?? "").slice(-150_000);
  const response = await client.messages.create({
    model, max_tokens: 3000,
    ...(info?.adaptiveThinking ? { thinking: { type: "disabled" as const } } : {}),
    system: mainT().main.handoffSystem,
    messages: [{ role: "user", content: mainT().main.handoffUser(String(payload?.title ?? "").slice(0, 200), transcript) }]
  });
  const usage = {
    model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0, cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0, webSearchRequests: 0
  };
  await recordUsage(usage);
  const text = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
  return { text: mainT().main.handoffIntro(String(payload?.title ?? "").slice(0, 80), text), usage };
});
ipcMain.handle("handoff:open", async (_event, payload: { text: string; target: "desktop" | "web" }) => {
  if (payload?.target === "web") { await shell.openExternal("https://claude.ai/new"); return true; }
  const text = String(payload?.text ?? "");
  if (!text.trim()) throw new Error(mainT().main.handoffEmpty);
  if (!fitsHandoff(text, process.platform)) throw new Error(mainT().main.handoffTooLong);
  await shell.openExternal(HANDOFF_PREFIX + encodeURIComponent(text));
  return true;
});
ipcMain.handle("style:fromSample", async (_event, payload: { sample: string; model: string }) => {
  // Like the Claude apps' "create a style from a writing sample": turn a sample into reusable instructions.
  const sample = String(payload?.sample ?? "").slice(0, 30_000);
  if (sample.trim().length < 40) throw new Error(mainT().main.sampleTooShort);
  const model = String(payload?.model ?? "");
  const info = modelCache.get(model);
  const client = new Anthropic({ apiKey: await getApiKey() });
  const response = await client.messages.create({
    model, max_tokens: 1200,
    ...(info?.adaptiveThinking ? { thinking: { type: "disabled" as const } } : {}),
    system: mainT().main.styleFromSampleSystem,
    messages: [{ role: "user", content: `<sample>\n${sample}\n</sample>` }]
  });
  await recordUsage({
    model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0, cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0, webSearchRequests: 0
  });
  return { prompt: response.content.filter(b => b.type === "text").map(b => b.text).join("").trim().slice(0, 4000), usage: { model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0, cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0 } };
});
ipcMain.handle("claude:title", async (_event, payload: { user: string; assistant: string }) => {
  // Use the cheapest small model without thinking so a tiny max_tokens still yields text.
  const candidates = [...modelCache.values()].filter(m => /haiku/.test(m.id)).sort((a, b) => (a.id.includes("4-5") ? -1 : 0) - (b.id.includes("4-5") ? -1 : 0));
  const pick = candidates[0];
  if (!pick) return null;
  const client = new Anthropic({ apiKey: await getApiKey() });
  const response = await client.messages.create({
    model: pick.id, max_tokens: 60,
    ...(pick.adaptiveThinking ? { thinking: { type: "disabled" as const }, ...(pick.effortLevels.includes("low") ? { output_config: { effort: "low" as const } } : {}) } : {}),
    system: mainT().main.titleSystem,
    messages: [{ role: "user", content: mainT().main.titleUser(String(payload?.user ?? "").slice(0, 2000), String(payload?.assistant ?? "").slice(0, 2000)) }]
  });
  await recordUsage({
    model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0, cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0, webSearchRequests: 0
  });
  // English titles need more characters than the 20-character Japanese ones.
  const title = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim().replace(/^["「『]|["」』]$/g, "").slice(0, getMainLocale() === "ja" ? 40 : 80);
  return { title: title || null, usage: { model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } };
});
