import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import AdmZip from "adm-zip";

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
    backgroundColor: "#262522", title: "Claude Continuity",
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
  await ensureDataDir(); createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

type NormalizedMessage = { role: "user" | "assistant"; content: string };
type NormalizedConversation = { id: string; title: string; messages: NormalizedMessage[]; source: string };

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
ipcMain.handle("chats:save", async (_event, chats: unknown[]) => {
  if (!Array.isArray(chats)) throw new Error("会話データの形式が正しくありません。");
  const safeChats = chats.map((chat: any) => ({
    id: String(chat.id ?? ""),
    title: String(chat.title ?? "会話").slice(0, 300),
    source: typeof chat.source === "string" ? chat.source.slice(0, 1000) : undefined,
    messages: Array.isArray(chat.messages) ? chat.messages.slice(-5000).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 2_000_000),
      ...(typeof m.thinking === "string" && m.thinking ? { thinking: m.thinking.slice(0, 500_000) } : {}),
      ...(typeof m.model === "string" ? { model: m.model.slice(0, 200) } : {}),
      ...(typeof m.costUsd === "number" && Number.isFinite(m.costUsd) ? { costUsd: m.costUsd } : {}),
      ...(m.aborted === true ? { aborted: true } : {})
    })) : []
  }));
  await fs.writeFile(chatsFile(), JSON.stringify(safeChats), "utf8");
  return true;
});


const usageFile = () => path.join(dataDir(), "usage.json");
ipcMain.handle("usage:load", async () => {
  try {
    const data = JSON.parse(await fs.readFile(usageFile(), "utf8"));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
});
type UsageEntry = { model: string; inputTokens: number; outputTokens: number; cacheCreationInputTokens: number; cacheReadInputTokens: number };
async function recordUsage(entry: UsageEntry) {
  let rows: any[] = [];
  try { const raw = JSON.parse(await fs.readFile(usageFile(), "utf8")); if (Array.isArray(raw)) rows = raw; } catch {}
  rows.push({ ...entry, sessionId, createdAt: new Date().toISOString() });
  // Retain a bounded local ledger instead of allowing indefinite growth.
  await fs.writeFile(usageFile(), JSON.stringify(rows.slice(-10000)), "utf8");
}
function fitContext(messages: NormalizedMessage[], maxChars = 120000): NormalizedMessage[] {
  // Anthropic Messages expects a user message to start the conversation. Keep a recent
  // contiguous suffix, then normalize adjacent roles to avoid malformed imported turns.
  const selected: NormalizedMessage[] = [];
  let remaining = maxChars;
  for (let i = messages.length - 1; i >= 0 && remaining > 0; i--) {
    const message = messages[i];
    if (!message.content) continue;
    if (message.content.length <= remaining) {
      selected.push({ role: message.role, content: message.content });
      remaining -= message.content.length;
    } else if (selected.length === 0) {
      selected.push({ role: message.role, content: message.content.slice(-remaining) });
      remaining = 0;
    } else {
      break;
    }
  }
  let ordered = selected.reverse();
  while (ordered.length && ordered[0].role !== "user") ordered.shift();
  const merged: NormalizedMessage[] = [];
  for (const message of ordered) {
    const last = merged[merged.length - 1];
    if (last && last.role === message.role) last.content += "\n\n" + message.content;
    else merged.push({ ...message });
  }
  return merged;
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
};
const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"];
// Capability fields are newer than SDK 0.68's ModelInfo type, so read them defensively.
function summarizeModel(model: any): ModelSummary {
  const caps = model?.capabilities ?? {};
  return {
    id: String(model.id),
    displayName: model.display_name || String(model.id),
    createdAt: model.created_at,
    maxTokens: typeof model.max_tokens === "number" && model.max_tokens > 0 ? model.max_tokens : undefined,
    maxInputTokens: typeof model.max_input_tokens === "number" && model.max_input_tokens > 0 ? model.max_input_tokens : undefined,
    effortLevels: caps.effort?.supported ? EFFORT_LEVELS.filter(level => caps.effort?.[level]?.supported) : [],
    adaptiveThinking: caps.thinking?.types?.adaptive?.supported === true
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

type ReplyPayload = { requestId: string; messages: NormalizedMessage[]; model?: string; effort?: string };
const activeReplies = new Map<string, AbortController>();
ipcMain.handle("claude:abort", (_event, requestId: string) => {
  activeReplies.get(String(requestId))?.abort();
  return true;
});
ipcMain.handle("claude:reply", async (event, payload: ReplyPayload) => {
  if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new Error("送信する会話がありません。");
  }
  const requestId = String(payload.requestId ?? randomUUID());
  const safeMessages = payload.messages
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 2_000_000) }));
  if (!safeMessages.some(m => m.role === "user")) throw new Error("ユーザーのメッセージがありません。");
  const bounded = fitContext(safeMessages);
  const model = payload.model || "claude-sonnet-4-5";
  const info = modelCache.get(model);
  const effort = payload.effort && info?.effortLevels.includes(payload.effort) ? payload.effort : undefined;
  const client = new Anthropic({ apiKey: await getApiKey() });
  // Thinking counts toward max_tokens, so allow the model's full output budget; streaming keeps long replies within SDK limits.
  const params: Record<string, unknown> = {
    model, max_tokens: info?.maxTokens ?? 8192,
    messages: bounded.map(m => ({ role: m.role, content: m.content })),
    // Newer models default to display "omitted" (empty thinking text); ask for the readable summary instead.
    ...(info?.adaptiveThinking ? { thinking: { type: "adaptive", display: "summarized" } } : {}),
    ...(effort ? { output_config: { effort } } : {})
  };
  const controller = new AbortController();
  activeReplies.set(requestId, controller);
  const send = (kind: "text" | "thinking", delta: string) => {
    if (!event.sender.isDestroyed()) event.sender.send("claude:stream", { requestId, kind, delta });
  };
  let text = "";
  let thinking = "";
  let snapshotUsage: any = null;
  let aborted = false;
  let finalModel = model;
  try {
    // output_config and adaptive thinking are newer than SDK 0.68's request types; the SDK forwards them unchanged.
    const stream = client.messages.stream(params as any, { signal: controller.signal });
    stream.on("text", delta => { text += delta; send("text", delta); });
    stream.on("thinking", delta => { thinking += delta; send("thinking", delta); });
    stream.on("streamEvent", (_e, snapshot) => { snapshotUsage = snapshot.usage; finalModel = snapshot.model || model; });
    const final = await stream.finalMessage();
    snapshotUsage = final.usage;
    finalModel = final.model || model;
  } catch (error) {
    if (!controller.signal.aborted) throw error;
    aborted = true;
  } finally {
    activeReplies.delete(requestId);
  }
  const usage = {
    model: finalModel,
    inputTokens: snapshotUsage?.input_tokens ?? 0,
    outputTokens: snapshotUsage?.output_tokens ?? 0,
    cacheCreationInputTokens: snapshotUsage?.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: snapshotUsage?.cache_read_input_tokens ?? 0
  };
  // A stopped reply still consumed tokens; record what the stream reported so far.
  if (snapshotUsage) await recordUsage(usage);
  return {
    text, thinking, aborted, usage,
    contextMessages: bounded.length,
    contextCharacters: bounded.reduce((total, m) => total + m.content.length, 0)
  };
});
