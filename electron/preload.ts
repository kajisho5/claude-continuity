import { contextBridge, ipcRenderer } from "electron";
type Msg = { role: "user" | "assistant"; content: string };
contextBridge.exposeInMainWorld("continuity", {
  chooseExport: () => ipcRenderer.invoke("dialog:import-export"),
  saveApiKey: (key: string) => ipcRenderer.invoke("key:save", key),
  keyStatus: () => ipcRenderer.invoke("key:status"),
  loadChats: () => ipcRenderer.invoke("chats:load"),
  loadUsage: () => ipcRenderer.invoke("usage:load"),
  saveChats: (chats: any[]) => ipcRenderer.invoke("chats:save", chats),
  reply: (payload: { messages: Msg[]; model?: string }) => ipcRenderer.invoke("claude:reply", payload)
});
