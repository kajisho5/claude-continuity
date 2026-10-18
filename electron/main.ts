import { app, BrowserWindow, dialog, ipcMain, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
const dataDir = () => path.join(app.getPath("userData"), "claude-continuity");
const keyFile = () => path.join(dataDir(), "api-key.bin");

async function ensureDataDir() { await fs.mkdir(dataDir(), { recursive: true }); }
function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 920, minWidth: 900, minHeight: 620, backgroundColor: "#111214", title: "Claude Continuity", webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  if (isDev) void mainWindow.loadURL("http://127.0.0.1:5173"); else void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.whenReady().then(async () => { await ensureDataDir(); createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

ipcMain.handle("dialog:import-export", async () => {
  const result = await dialog.showOpenDialog({ title: "Claudeのエクスポートデータを選択", properties: ["openFile"], filters: [{ name: "JSON / ZIP", extensions: ["json", "zip"] }, { name: "すべてのファイル", extensions: ["*"] }] });
  if (result.canceled || !result.filePaths[0]) return null;
  return { filePath: result.filePaths[0], fileName: path.basename(result.filePaths[0]) };
});
ipcMain.handle("key:save", async (_event, apiKey: string) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("この環境では安全なキー保存を利用できません。");
  if (!apiKey || !apiKey.startsWith("sk-ant-")) throw new Error("Anthropic APIキーの形式を確認してください。");
  await fs.writeFile(keyFile(), safeStorage.encryptString(apiKey)); return true;
});
ipcMain.handle("key:status", async () => { try { if (!safeStorage.isEncryptionAvailable()) return { configured: false, secureStorage: false }; const encrypted = await fs.readFile(keyFile()); return { configured: encrypted.length > 0, secureStorage: true }; } catch { return { configured: false, secureStorage: safeStorage.isEncryptionAvailable() }; } });
async function getApiKey() { if (!safeStorage.isEncryptionAvailable()) throw new Error("安全なキー保存が利用できません。"); return safeStorage.decryptString(await fs.readFile(keyFile())); }
ipcMain.handle("claude:reply", async (_event, payload: { messages: { role: "user" | "assistant"; content: string }[]; model?: string }) => {
  const client = new Anthropic({ apiKey: await getApiKey() });
  const response = await client.messages.create({ model: payload.model || "claude-sonnet-4-5", max_tokens: 4096, messages: payload.messages.map(m => ({ role: m.role, content: m.content })) });
  return { text: response.content.filter(p => p.type === "text").map(p => p.text).join("\n"), usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, model: response.model } };
});
