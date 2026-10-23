import { app, BrowserWindow, dialog, ipcMain, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import AdmZip from "adm-zip";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
const dataDir = () => path.join(app.getPath("userData"), "claude-continuity");
const sessionId = randomUUID();
const keyFile = () => path.join(dataDir(), "api-key.bin");

async function ensureDataDir() { await fs.mkdir(dataDir(), { recursive: true }); }
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 620,
    backgroundColor: "#111214", title: "Claude Continuity",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
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
      content: String(m.content ?? "").slice(0, 2_000_000)
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
async function recordUsage(entry: { model: string; inputTokens: number; outputTokens: number }) {
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
ipcMain.handle("claude:models", async () => {
  // Follow every page so the selector shows all models the key can access.
  const client = new Anthropic({ apiKey: await getApiKey() });
  const models: { id: string; displayName: string; createdAt?: string }[] = [];
  for await (const model of client.models.list({ limit: 1000 })) {
    models.push({ id: model.id, displayName: model.display_name || model.id, createdAt: model.created_at });
  }
  return models;
});
ipcMain.handle("claude:reply", async (_event, payload: { messages: NormalizedMessage[]; model?: string }) => {
  if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new Error("送信する会話がありません。");
  }
  const safeMessages = payload.messages
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 2_000_000) }));
  if (!safeMessages.some(m => m.role === "user")) throw new Error("ユーザーのメッセージがありません。");
  const bounded = fitContext(safeMessages);
  const client = new Anthropic({ apiKey: await getApiKey() });
  const response = await client.messages.create({
    model: payload.model || "claude-sonnet-4-5", max_tokens: 4096,
    messages: bounded.map(m => ({ role: m.role, content: m.content }))
  });
  const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, model: response.model };
  await recordUsage(usage);
  return {
    text: response.content.filter(p => p.type === "text").map(p => p.text).join("\n"),
    usage,
    contextMessages: bounded.length,
    contextCharacters: bounded.reduce((total, m) => total + m.content.length, 0)
  };
});
