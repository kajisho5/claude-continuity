import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
type StreamEvent = { requestId: string; kind: "text" | "thinking" | "activity"; delta: string };
contextBridge.exposeInMainWorld("continuity", {
  chooseExport: () => ipcRenderer.invoke("dialog:import-export"),
  exportChat: (payload: { fileName: string; data: string; format?: "json" | "html" }) => ipcRenderer.invoke("dialog:export-chat", payload),
  saveApiKey: (key: string) => ipcRenderer.invoke("key:save", key),
  testApiKey: (key: string) => ipcRenderer.invoke("key:test", key),
  keyStatus: () => ipcRenderer.invoke("key:status"),
  loadChats: () => ipcRenderer.invoke("chats:load"),
  loadUsage: () => ipcRenderer.invoke("usage:load"),
  saveChats: (chats: any[]) => ipcRenderer.invoke("chats:save", chats),
  loadCredit: () => ipcRenderer.invoke("credit:load"),
  saveCredit: (settings: unknown) => ipcRenderer.invoke("credit:save", settings),
  loadPrefs: () => ipcRenderer.invoke("prefs:load"),
  backupData: () => ipcRenderer.invoke("data:backup"),
  restoreData: () => ipcRenderer.invoke("data:restore"),
  openDataFolder: () => ipcRenderer.invoke("data:openFolder"),
  focusWindow: () => ipcRenderer.invoke("window:focus"),
  captureScreen: () => ipcRenderer.invoke("capture:screen"),
  browser: {
    open: (url: string) => ipcRenderer.invoke("browser:open", url),
    layout: (bounds: { x: number; y: number; width: number; height: number }, visible: boolean) => ipcRenderer.invoke("browser:layout", bounds, visible),
    state: () => ipcRenderer.invoke("browser:state"),
    back: () => ipcRenderer.invoke("browser:back"),
    forward: () => ipcRenderer.invoke("browser:forward"),
    reload: () => ipcRenderer.invoke("browser:reload"),
    stop: () => ipcRenderer.invoke("browser:stop"),
    openExternal: () => ipcRenderer.invoke("browser:external"),
    close: () => ipcRenderer.invoke("browser:close"),
    clearData: () => ipcRenderer.invoke("browser:clearData"),
    attachPage: () => ipcRenderer.invoke("browser:attachPage"),
    attachCapture: () => ipcRenderer.invoke("browser:attachCapture"),
    onState: (listener: (state: unknown) => void) => {
      const handler = (_event: IpcRendererEvent, state: unknown) => listener(state);
      ipcRenderer.on("browser:state", handler);
      return () => { ipcRenderer.removeListener("browser:state", handler); };
    },
    onOpenRequest: (listener: (url: string) => void) => {
      const handler = (_event: IpcRendererEvent, url: string) => listener(String(url));
      ipcRenderer.on("browser:openRequest", handler);
      return () => { ipcRenderer.removeListener("browser:openRequest", handler); };
    }
  },
  shortcutStatus: () => ipcRenderer.invoke("shortcut:status"),
  onQuick: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on("app:quick", handler);
    return () => { ipcRenderer.removeListener("app:quick", handler); };
  },
  listConnectors: () => ipcRenderer.invoke("connectors:list"),
  saveConnector: (input: unknown) => ipcRenderer.invoke("connectors:save", input),
  deleteConnector: (id: string) => ipcRenderer.invoke("connectors:delete", id),
  testConnector: (id: string) => ipcRenderer.invoke("connectors:test", id),
  listSkills: () => ipcRenderer.invoke("skills:list"),
  uploadSkill: (kind: "folder" | "file") => ipcRenderer.invoke("skills:upload", kind),
  deleteSkill: (id: string) => ipcRenderer.invoke("skills:delete", id),
  importDesktopConnectors: () => ipcRenderer.invoke("connectors:importDesktop"),
  resetAllowedTools: (id: string) => ipcRenderer.invoke("connectors:resetAllowed", id),
  setConnectorEnabled: (id: string, enabled: boolean) => ipcRenderer.invoke("connectors:setEnabled", id, enabled),
  answerApproval: (approvalId: string, decision: string) => ipcRenderer.invoke("claude:approve", approvalId, decision),
  onApproval: (listener: (approval: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, payload: unknown) => listener(payload);
    ipcRenderer.on("claude:approval", handler);
    return () => { ipcRenderer.removeListener("claude:approval", handler); };
  },
  styleFromSample: (payload: unknown) => ipcRenderer.invoke("style:fromSample", payload),
  attachmentText: (id: string) => ipcRenderer.invoke("attachments:text", id),
  openAttachmentPdf: (id: string, name: string) => ipcRenderer.invoke("attachments:openPdf", id, name),
  appVersion: () => ipcRenderer.invoke("app:version"),
  updateStatus: () => ipcRenderer.invoke("update:status"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateStatus: (listener: (status: unknown) => void) => {
    const handler = (_event: unknown, status: unknown) => listener(status);
    ipcRenderer.on("update:status", handler);
    return () => { ipcRenderer.removeListener("update:status", handler); };
  },
  summarizeHandoff: (payload: unknown) => ipcRenderer.invoke("handoff:summarize", payload),
  openHandoff: (payload: unknown) => ipcRenderer.invoke("handoff:open", payload),
  savePrefs: (prefs: unknown) => ipcRenderer.invoke("prefs:save", prefs),
  loadProjects: () => ipcRenderer.invoke("projects:load"),
  saveProjects: (projects: unknown) => ipcRenderer.invoke("projects:save", projects),
  pickAttachments: () => ipcRenderer.invoke("attachments:pick"),
  addAttachmentFiles: (files: File[]) => ipcRenderer.invoke("attachments:addPaths", files.map(file => webUtils.getPathForFile(file)).filter(Boolean)),
  addAttachmentData: (name: string, data: Uint8Array) => ipcRenderer.invoke("attachments:addData", { name, data }),
  attachmentPreview: (id: string, full?: boolean) => ipcRenderer.invoke("attachments:preview", id, full === true),
  listMemory: () => ipcRenderer.invoke("memory:list"),
  deleteMemory: (path: string) => ipcRenderer.invoke("memory:delete", path),
  writeMemory: (path: string, text: string) => ipcRenderer.invoke("memory:write", path, text),
  saveGeneratedFile: (fileId: string, name: string) => ipcRenderer.invoke("files:save", { fileId, name }),
  mcpInfo: () => ipcRenderer.invoke("mcp:info"),
  pickMcpFolders: () => ipcRenderer.invoke("mcp:pickFolder"),
  listModels: () => ipcRenderer.invoke("claude:models"),
  reply: (payload: unknown) => ipcRenderer.invoke("claude:reply", payload),
  estimate: (payload: unknown) => ipcRenderer.invoke("estimate:count", payload),
  createBatch: (payload: unknown) => ipcRenderer.invoke("batch:create", payload),
  listBatches: () => ipcRenderer.invoke("batch:list"),
  cancelBatch: (id: string) => ipcRenderer.invoke("batch:cancel", id),
  ackBatch: (id: string) => ipcRenderer.invoke("batch:ack", id),
  clearBatches: () => ipcRenderer.invoke("batch:clear"),
  onBatchUpdate: (listener: (jobs: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, jobs: unknown) => listener(jobs);
    ipcRenderer.on("batch:update", handler);
    return () => { ipcRenderer.removeListener("batch:update", handler); };
  },
  generateTitle: (user: string, assistant: string) => ipcRenderer.invoke("claude:title", { user, assistant }),
  abortReply: (requestId: string) => ipcRenderer.invoke("claude:abort", requestId),
  onStream: (listener: (event: StreamEvent) => void) => {
    const handler = (_event: IpcRendererEvent, payload: StreamEvent) => listener(payload);
    ipcRenderer.on("claude:stream", handler);
    return () => { ipcRenderer.removeListener("claude:stream", handler); };
  }
});
