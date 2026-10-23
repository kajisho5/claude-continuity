import { app, BrowserWindow, dialog, ipcMain, nativeTheme, safeStorage, shell } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import AdmZip from "adm-zip";
import type { MessageParam, ContentBlock, Message } from "@anthropic-ai/sdk/resources/messages";
import { AttachmentStore, type Attachment } from "./attachments";
import { listMemoryFiles, runMemoryCommand } from "./memory";
import { createBackup, readBackup, restoreEntries } from "./backup";
import { HANDOFF_PREFIX, fitsHandoff } from "../src/lib/handoff";
import { activityLabel, buildMessages, buildSystem, buildTools, extractFileIds, extractText, type ChatTurn, type Project, type StyleId, type ToolFlags } from "./request";

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
  nativeTheme.themeSource = (await loadPrefs()).theme;
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

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
      title: String(item.name ?? item.title ?? item.summary ?? "インポートした会話").trim() || "インポートした会話",
      messages,
      ...isoDate(item.updated_at ?? item.created_at),
      source
    });
  }
  // Some exports contain a single conversation object rather than a list.
  if (!unique.size) {
    const messages = extractMessages(data);
    if (messages.length) unique.set("single", { id: "imported-single", title: String(data.name ?? data.title ?? "インポートした会話"), messages, source });
  }
  return [...unique.values()];
}


ipcMain.handle("dialog:export-chat", async (_event, payload: { fileName: string; data: string }) => {
  const safeName = String(payload?.fileName ?? "claude-conversation").replace(/[\\\\/:*?"<>|]/g, "_").slice(0, 100) || "claude-conversation";
  const result = await dialog.showSaveDialog({
    title: "会話をJSONでエクスポート",
    defaultPath: safeName.endsWith(".json") ? safeName : safeName + ".json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, String(payload?.data ?? ""), "utf8");
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle("dialog:import-export", async () => {
  const result = await dialog.showOpenDialog({
    title: "Claudeのエクスポートデータを選択", properties: ["openFile"],
    filters: [{ name: "Claude export (JSON / ZIP)", extensions: ["json", "zip"] }, { name: "すべてのファイル", extensions: ["*"] }]
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
    if (stat.size > 50 * 1024 * 1024) throw new Error("JSONファイルが大きすぎます（上限50MB）。");
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
    ...(Array.isArray(m.citations) ? { citations: m.citations.slice(0, 100).map((c: any) => ({ url: str(c?.url, 2000) ?? "", title: str(c?.title, 500) ?? "", ...(c?.citedText ? { citedText: str(c.citedText, 1000) } : {}) })) } : {}),
    ...(Array.isArray(m.files) ? { files: m.files.slice(0, 50).map((f: any) => ({ fileId: str(f?.fileId, 200) ?? "", name: str(f?.name, 300) ?? "file", ...(typeof f?.size === "number" ? { size: f.size } : {}) })) } : {})
  };
}
ipcMain.handle("chats:save", async (_event, chats: unknown[]) => {
  if (!Array.isArray(chats)) throw new Error("会話データの形式が正しくありません。");
  const safeChats = chats.map((chat: any) => ({
    id: String(chat.id ?? ""),
    title: String(chat.title ?? "会話").slice(0, 300),
    source: typeof chat.source === "string" ? chat.source.slice(0, 1000) : undefined,
    ...(typeof chat.projectId === "string" ? { projectId: chat.projectId.slice(0, 100) } : {}),
    ...(chat.starred === true ? { starred: true } : {}),
    ...isoDate(chat.updatedAt),
    ...(typeof chat.style === "string" ? { style: chat.style.slice(0, 40) } : {}),
    ...(chat.tools && typeof chat.tools === "object" ? { tools: Object.fromEntries(["webSearch", "webFetch", "files", "analysis", "memory"].map(k => [k, chat.tools[k] === true])) } : {}),
    ...(chat.container && typeof chat.container.id === "string" ? { container: { id: chat.container.id.slice(0, 200), expiresAt: str(chat.container.expiresAt, 60) } } : {}),
    messages: Array.isArray(chat.messages) ? chat.messages.slice(-5000).map((m: any) => {
      const role = m.role === "assistant" ? "assistant" : "user";
      const attachments = role === "user" ? sanitizeAttachments(m.attachments) : undefined;
      return {
        role, ...sanitizeReply(m),
        ...(attachments?.length ? { attachments } : {}),
        ...(role === "assistant" && Array.isArray(m.alternates) ? { alternates: m.alternates.slice(0, 20).map(sanitizeReply), altIndex: Number(m.altIndex) || 0 } : {})
      };
    }) : []
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
    title: "すべてのデータをバックアップ", defaultPath: `claude-continuity-backup-${stamp()}.zip`,
    filters: [{ name: "ZIP", extensions: ["zip"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const { zip, count } = await createBackup(dataDir(), app.getVersion());
  await fs.writeFile(result.filePath, zip.toBuffer());
  return { canceled: false, filePath: result.filePath, count };
});
ipcMain.handle("data:openFolder", async () => {
  const error = await shell.openPath(dataDir());
  if (error) throw new Error(error);
  return true;
});
ipcMain.handle("data:restore", async () => {
  const result = await dialog.showOpenDialog({ title: "バックアップから復元", properties: ["openFile"], filters: [{ name: "ZIP", extensions: ["zip"] }] });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const stat = await fs.stat(result.filePaths[0]);
  if (stat.size > 2 * 1024 * 1024 * 1024) throw new Error("バックアップファイルが大きすぎます（上限 2GB）。");
  let zip: AdmZip;
  try { zip = new AdmZip(result.filePaths[0]); } catch { throw new Error("ZIP ファイルを開けませんでした。"); }
  const entries = readBackup(zip);
  // Keep the current state next to the data folder so a mistaken restore can be undone by restoring this file.
  const safetyDir = path.join(app.getPath("userData"), "backups");
  await fs.mkdir(safetyDir, { recursive: true });
  const safetyPath = path.join(safetyDir, `before-restore-${stamp()}.zip`);
  await fs.writeFile(safetyPath, (await createBackup(dataDir(), app.getVersion())).zip.toBuffer());
  await restoreEntries(dataDir(), entries);
  nativeTheme.themeSource = (await loadPrefs()).theme;
  return { canceled: false, count: entries.length, safetyPath };
});
ipcMain.handle("mcp:info", () => {
  // Packaged builds unpack dist-mcp from the asar archive so the Electron binary can run it as Node.
  const appPath = app.getAppPath();
  const base = app.isPackaged ? appPath.replace(/app\.asar$/, "app.asar.unpacked") : appPath;
  return { serverPath: path.join(base, "dist-mcp", "server.js"), runtimePath: process.execPath, dataDir: dataDir(), platform: process.platform };
});
ipcMain.handle("mcp:pickFolder", async () => {
  const result = await dialog.showOpenDialog({ title: "MCP サーバーに読ませてよいフォルダ", properties: ["openDirectory", "multiSelections"] });
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
  if (!safeStorage.isEncryptionAvailable()) throw new Error("この環境では安全なキー保存を利用できません。");
  if (!apiKey || !apiKey.startsWith("sk-ant-")) throw new Error("Anthropic APIキーの形式を確認してください。");
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
  if (!safeStorage.isEncryptionAvailable()) throw new Error("安全なキー保存が利用できません。");
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
  if (!apiKey || !apiKey.startsWith("sk-ant-")) throw new Error("Anthropic APIキーの形式を確認してください（sk-ant- で始まります）。");
  const models = await listModels(apiKey);
  return { ok: true, modelCount: models.length };
});

const creditFile = () => path.join(dataDir(), "credit.json");
const PLANS = ["max5x", "max20x", "team", "custom", "none"];
ipcMain.handle("credit:load", async () => {
  try { return JSON.parse(await fs.readFile(creditFile(), "utf8")); } catch { return null; }
});
ipcMain.handle("credit:save", async (_event, value: any) => {
  if (!value || typeof value !== "object") throw new Error("クレジット設定の形式が正しくありません。");
  const plan = value.plan == null ? null : String(value.plan);
  if (plan !== null && !PLANS.includes(plan)) throw new Error("プランの値が正しくありません。");
  const amount = Number(value.monthlyAmountUsd ?? 0);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10000) throw new Error("月間付与額は 0〜10,000 USD で入力してください。");
  const resetDay = Math.round(Number(value.resetDay ?? 1));
  if (!(resetDay >= 1 && resetDay <= 31)) throw new Error("付与日は 1〜31 で入力してください。");
  let calibration: { balanceUsd: number; observedAt: string } | undefined;
  if (value.calibration) {
    const balanceUsd = Number(value.calibration.balanceUsd);
    const observedAt = new Date(String(value.calibration.observedAt));
    if (!Number.isFinite(balanceUsd) || balanceUsd < 0 || Number.isNaN(observedAt.getTime())) throw new Error("補正値が正しくありません。");
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
type Prefs = { autoTitle: boolean; customStyle: string; displayName: string; theme: Theme; chatFont: ChatFont };
const THEMES: Theme[] = ["system", "light", "dark"];
const FONTS: ChatFont[] = ["serif", "sans", "system"];
function sanitizePrefs(raw: any): Prefs {
  return {
    autoTitle: raw?.autoTitle !== false,
    customStyle: typeof raw?.customStyle === "string" ? raw.customStyle.slice(0, 4000) : "",
    displayName: typeof raw?.displayName === "string" ? raw.displayName.trim().slice(0, 40) : "",
    theme: THEMES.includes(raw?.theme) ? raw.theme : "dark",
    chatFont: FONTS.includes(raw?.chatFont) ? raw.chatFont : "serif"
  };
}
async function loadPrefs(): Promise<Prefs> {
  try { return sanitizePrefs(JSON.parse(await fs.readFile(prefsFile(), "utf8"))); }
  catch { return sanitizePrefs({}); }
}
ipcMain.handle("prefs:load", () => loadPrefs());
ipcMain.handle("prefs:save", async (_event, value: unknown) => {
  const prefs = sanitizePrefs(value);
  await fs.writeFile(prefsFile(), JSON.stringify(prefs), "utf8");
  nativeTheme.themeSource = prefs.theme;
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
  if (!Array.isArray(list)) throw new Error("プロジェクトの形式が正しくありません。");
  const projects: Project[] = list.slice(0, 200).map((p: any) => ({
    id: String(p?.id ?? randomUUID()).slice(0, 100),
    name: String(p?.name ?? "プロジェクト").slice(0, 100) || "プロジェクト",
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
  const result = await dialog.showOpenDialog({ title: "ファイルを添付", properties: ["openFile", "multiSelections"] });
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

// ---- Memory ----
const memoryRoot = () => path.join(dataDir(), "memories");
ipcMain.handle("memory:list", () => listMemoryFiles(memoryRoot()));
ipcMain.handle("memory:delete", async (_event, virtualPath: string) => {
  const result = await runMemoryCommand(memoryRoot(), { command: "delete", path: String(virtualPath) });
  if (result.isError) throw new Error(result.content);
  return true;
});

// ---- Generated files ----
ipcMain.handle("files:save", async (_event, payload: { fileId: string; name: string }) => {
  const fileId = String(payload?.fileId ?? "");
  if (!/^file_[A-Za-z0-9_-]+$/.test(fileId)) throw new Error("ファイル ID が正しくありません。");
  const result = await dialog.showSaveDialog({ title: "生成されたファイルを保存", defaultPath: String(payload?.name ?? "output").replace(/[\\/:*?"<>|]/g, "_").slice(0, 150) });
  if (result.canceled || !result.filePath) return { canceled: true };
  const client = new Anthropic({ apiKey: await getApiKey() });
  const response = await client.files.download(fileId);
  await fs.writeFile(result.filePath, Buffer.from(await response.arrayBuffer()));
  return { canceled: false, filePath: result.filePath };
});

// ---- Replies ----
type ReplyPayload = {
  requestId: string; messages: ChatTurn[]; model?: string; effort?: string;
  style?: StyleId; projectId?: string; tools?: ToolFlags; containerId?: string;
};
const activeReplies = new Map<string, AbortController>();
const MAX_LOOP = 8;
ipcMain.handle("claude:abort", (_event, requestId: string) => {
  activeReplies.get(String(requestId))?.abort();
  return true;
});
function sanitizeTurns(list: unknown): ChatTurn[] {
  if (!Array.isArray(list)) return [];
  return list.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2_000_000), ...(m.role === "user" ? { attachments: sanitizeAttachments(m.attachments) } : {}) }));
}
ipcMain.handle("claude:reply", async (event, payload: ReplyPayload) => {
  const turns = sanitizeTurns(payload?.messages);
  if (!turns.length) throw new Error("送信する会話がありません。");
  if (!turns.some(m => m.role === "user")) throw new Error("ユーザーのメッセージがありません。");
  const requestId = String(payload.requestId ?? randomUUID());
  const model = payload.model || "claude-sonnet-4-5";
  const info = modelCache.get(model);
  const caps = { webSearch: info?.webSearch ?? true, codeExecution: info?.codeExecution ?? true, imageInput: info?.imageInput ?? true, pdfInput: info?.pdfInput ?? true };
  const effort = payload.effort && info?.effortLevels.includes(payload.effort) ? payload.effort : undefined;
  const [prefs, projects] = await Promise.all([loadPrefs(), loadProjects()]);
  const project = payload.projectId ? projects.find(p => p.id === payload.projectId) ?? null : null;
  const flags: ToolFlags = { ...(payload.tools ?? {}), memory: payload.tools?.memory === true || project?.memory === true };
  const { tools, skills, unavailable } = buildTools(flags, caps);
  const codeOn = tools.some(t => t.type === "code_execution_20250825");
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
  const built = await buildMessages(turns, project?.knowledge ?? [], loader, { containerUploads: codeOn, caps });
  const messages: MessageParam[] = built.messages;
  const system = buildSystem(payload.style, prefs.customStyle, project);
  const containerId = typeof payload.containerId === "string" && payload.containerId ? payload.containerId : undefined;

  const controller = new AbortController();
  activeReplies.set(requestId, controller);
  const send = (kind: "text" | "thinking" | "activity", delta: string) => {
    if (!event.sender.isDestroyed()) event.sender.send("claude:stream", { requestId, kind, delta });
  };
  const totals = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0, searches: 0 };
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
  try {
    for (let iteration = 0; iteration < MAX_LOOP; iteration++) {
      // Thinking counts toward max_tokens, so allow the model's full output budget; streaming keeps long replies within SDK limits.
      const stream = client.messages.stream({
        model, max_tokens: info?.maxTokens ?? 8192, messages,
        ...(system ? { system } : {}),
        ...(tools.length ? { tools } : {}),
        ...(skills.length || container ? { container: { ...(container ? { id: container.id } : {}), ...(skills.length ? { skills: skills.map(skill_id => ({ type: "anthropic" as const, skill_id, version: "latest" })) } : {}) } } : {}),
        // Newer models default to display "omitted" (empty thinking text); ask for the readable summary instead.
        ...(info?.adaptiveThinking ? { thinking: { type: "adaptive" as const, display: "summarized" as const } } : {}),
        ...(effort ? { output_config: { effort: effort as "high" } } : {}),
        // Automatic prompt caching: the cache breakpoint moves forward with the conversation.
        cache_control: { type: "ephemeral" }
      }, { signal: controller.signal });
      stream.on("text", delta => send("text", delta));
      stream.on("thinking", delta => { thinking += delta; send("thinking", delta); });
      stream.on("streamEvent", (e, snapshot) => {
        pendingUsage = snapshot.usage;
        finalModel = snapshot.model || model;
        if (e.type === "content_block_start") {
          const label = activityLabel((e.content_block as { name?: string }).name);
          if (label && (e.content_block.type === "server_tool_use" || e.content_block.type === "tool_use")) send("activity", label);
        }
      });
      const final: Message = await stream.finalMessage();
      addUsage(final.usage); pendingUsage = null;
      finalModel = final.model || model;
      // Separate text written before and after a tool round-trip, matching the "\n\n" streamed live.
      if (turnBlocks.some(b => b.type === "text") && final.content.some(b => b.type === "text")) turnBlocks.push({ type: "text", text: "\n\n", citations: null } as ContentBlock);
      turnBlocks.push(...final.content);
      if (final.container?.id) container = { id: final.container.id, expiresAt: final.container.expires_at };
      if (final.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: final.content });
        continue;
      }
      if (final.stop_reason === "tool_use") {
        const results = [];
        for (const block of final.content) {
          if (block.type !== "tool_use") continue;
          const outcome = block.name === "memory"
            ? await runMemoryCommand(memoryRoot(), (block.input ?? {}) as Record<string, unknown>)
            : { content: `Error: unknown tool ${block.name}`, isError: true };
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
  return { text, thinking, aborted, usage, citations, files, container, notices: [...built.skipped.map(s => `添付をスキップ: ${s}`), ...unavailable.map(u => `${u}はこのモデルでは使えません`)] };
});

// ---- Hand off to the Claude apps (claude://claude.ai/new?q=…, prefilled, never auto-sent) ----
const HANDOFF_SYSTEM = `あなたは会話の引き継ぎメモを書く担当です。渡された会話記録を読み、別の Claude がこのメモだけで作業を続けられるように、日本語で次の見出しの順にまとめてください。
## 目的
## これまでに決まったこと・前提
## 現在の状態（直近の成果物や結論。重要なコード・数値・固有名詞は省略しない）
## 未解決の点・次にやること
最後の行に「上記を踏まえて続きを手伝ってください。」と書いてください。全体で 2,500 文字以内。会話にない事実を足さないこと。`;
ipcMain.handle("handoff:summarize", async (_event, payload: { model: string; title: string; transcript: string }) => {
  const model = String(payload?.model ?? "");
  const info = modelCache.get(model);
  const client = new Anthropic({ apiKey: await getApiKey() });
  // Keep the newest part when the record is long; the summary is about where things stand now.
  const transcript = String(payload?.transcript ?? "").slice(-150_000);
  const response = await client.messages.create({
    model, max_tokens: 3000,
    ...(info?.adaptiveThinking ? { thinking: { type: "disabled" as const } } : {}),
    system: HANDOFF_SYSTEM,
    messages: [{ role: "user", content: `会話タイトル: ${String(payload?.title ?? "").slice(0, 200)}\n\n<conversation>\n${transcript}\n</conversation>` }]
  });
  const usage = {
    model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0, cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0, webSearchRequests: 0
  };
  await recordUsage(usage);
  const text = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
  return { text: `これは別のアプリ（Claude API）で続けていた会話「${String(payload?.title ?? "").slice(0, 80)}」の引き継ぎメモです。\n\n${text}`, usage };
});
ipcMain.handle("handoff:open", async (_event, payload: { text: string; target: "desktop" | "web" }) => {
  if (payload?.target === "web") { await shell.openExternal("https://claude.ai/new"); return true; }
  const text = String(payload?.text ?? "");
  if (!text.trim()) throw new Error("引き継ぐ内容が空です。");
  if (!fitsHandoff(text, process.platform)) throw new Error("内容が長すぎます。短くしてから開いてください。");
  await shell.openExternal(HANDOFF_PREFIX + encodeURIComponent(text));
  return true;
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
    system: "会話の内容を表す日本語のタイトルを20文字以内で1つだけ出力してください。記号や引用符、説明は不要です。",
    messages: [{ role: "user", content: `ユーザー: ${String(payload?.user ?? "").slice(0, 2000)}\n\nアシスタント: ${String(payload?.assistant ?? "").slice(0, 2000)}` }]
  });
  await recordUsage({
    model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0, cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0, webSearchRequests: 0
  });
  const title = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim().replace(/^["「『]|["」』]$/g, "").slice(0, 40);
  return { title: title || null, usage: { model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } };
});
