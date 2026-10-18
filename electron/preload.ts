import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("continuity", {
  chooseExport: () => ipcRenderer.invoke("dialog:import-export"),
  saveApiKey: (key: string) => ipcRenderer.invoke("key:save", key),
  keyStatus: () => ipcRenderer.invoke("key:status"),
  reply: (payload: { messages: { role: "user" | "assistant"; content: string }[]; model?: string }) => ipcRenderer.invoke("claude:reply", payload)
});
