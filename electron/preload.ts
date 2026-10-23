import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
type StreamEvent = { requestId: string; kind: "text" | "thinking" | "activity"; delta: string };
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
  loadPrefs: () => ipcRenderer.invoke("prefs:load"),
  savePrefs: (prefs: unknown) => ipcRenderer.invoke("prefs:save", prefs),
  loadProjects: () => ipcRenderer.invoke("projects:load"),
  saveProjects: (projects: unknown) => ipcRenderer.invoke("projects:save", projects),
  pickAttachments: () => ipcRenderer.invoke("attachments:pick"),
  addAttachmentFiles: (files: File[]) => ipcRenderer.invoke("attachments:addPaths", files.map(file => webUtils.getPathForFile(file)).filter(Boolean)),
  addAttachmentData: (name: string, data: Uint8Array) => ipcRenderer.invoke("attachments:addData", { name, data }),
  attachmentPreview: (id: string) => ipcRenderer.invoke("attachments:preview", id),
  listMemory: () => ipcRenderer.invoke("memory:list"),
  deleteMemory: (path: string) => ipcRenderer.invoke("memory:delete", path),
  saveGeneratedFile: (fileId: string, name: string) => ipcRenderer.invoke("files:save", { fileId, name }),
  listModels: () => ipcRenderer.invoke("claude:models"),
  reply: (payload: unknown) => ipcRenderer.invoke("claude:reply", payload),
  generateTitle: (user: string, assistant: string) => ipcRenderer.invoke("claude:title", { user, assistant }),
  abortReply: (requestId: string) => ipcRenderer.invoke("claude:abort", requestId),
  onStream: (listener: (event: StreamEvent) => void) => {
    const handler = (_event: IpcRendererEvent, payload: StreamEvent) => listener(payload);
    ipcRenderer.on("claude:stream", handler);
    return () => { ipcRenderer.removeListener("claude:stream", handler); };
  }
});
