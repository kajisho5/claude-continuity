import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
type Msg = { role: "user" | "assistant"; content: string };
type StreamEvent = { requestId: string; kind: "text" | "thinking"; delta: string };
contextBridge.exposeInMainWorld("continuity", {
  chooseExport: () => ipcRenderer.invoke("dialog:import-export"),
  exportChat: (payload: { fileName: string; data: string }) => ipcRenderer.invoke("dialog:export-chat", payload),
  saveApiKey: (key: string) => ipcRenderer.invoke("key:save", key),
  testApiKey: (key: string) => ipcRenderer.invoke("key:test", key),
  keyStatus: () => ipcRenderer.invoke("key:status"),
  loadChats: () => ipcRenderer.invoke("chats:load"),
  loadUsage: () => ipcRenderer.invoke("usage:load"),
  saveChats: (chats: any[]) => ipcRenderer.invoke("chats:save", chats),
  loadCredit: () => ipcRenderer.invoke("credit:load"),
  saveCredit: (settings: unknown) => ipcRenderer.invoke("credit:save", settings),
  listModels: () => ipcRenderer.invoke("claude:models"),
  reply: (payload: { requestId: string; messages: Msg[]; model?: string; effort?: string }) => ipcRenderer.invoke("claude:reply", payload),
  abortReply: (requestId: string) => ipcRenderer.invoke("claude:abort", requestId),
  onStream: (listener: (event: StreamEvent) => void) => {
    const handler = (_event: IpcRendererEvent, payload: StreamEvent) => listener(payload);
    ipcRenderer.on("claude:stream", handler);
    return () => { ipcRenderer.removeListener("claude:stream", handler); };
  }
});
