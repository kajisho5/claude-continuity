export {};
type ContinuityAttachment = { id: string; name: string; mediaType: string; size: number; kind: "image" | "pdf" | "text" | "file" };
type ContinuityCitation = { url: string; title: string; citedText?: string };
type ContinuityFile = { fileId: string; name: string; size?: number };
type ContinuityReply = {
  content: string; thinking?: string; model?: string; costUsd?: number; aborted?: boolean;
  citations?: ContinuityCitation[]; files?: ContinuityFile[]; steps?: ContinuityStep[]; stopReason?: string;
};
type ContinuityStep = import("./lib/steps").ToolStep;
type ContinuityUpdateStatus = import("./lib/update").UpdateStatus;
type ContinuityMessage = ContinuityReply & {
  role: "user" | "assistant";
  attachments?: ContinuityAttachment[];
  alternates?: ContinuityReply[];
  altIndex?: number;
};
type ContinuityTools = { webSearch?: boolean; webFetch?: boolean; files?: boolean; analysis?: boolean; memory?: boolean };
type ContinuityConversation = {
  id: string; title: string; messages: ContinuityMessage[]; source?: string;
  projectId?: string; style?: string; tools?: ContinuityTools; container?: { id: string; expiresAt?: string };
};
type ContinuityProject = { id: string; name: string; instructions: string; knowledge: ContinuityAttachment[]; memory: boolean };
type ContinuityPrefs = import("./lib/prefs").Prefs;
type ContinuityUsage = {
  model: string; inputTokens: number; outputTokens: number;
  cacheCreationInputTokens: number; cacheReadInputTokens: number; webSearchRequests?: number; source?: string;
};
type ContinuityModel = {
  id: string; displayName: string; createdAt?: string; maxTokens?: number; maxInputTokens?: number;
  effortLevels: string[]; adaptiveThinking: boolean; webSearch: boolean; codeExecution: boolean; imageInput: boolean; pdfInput: boolean;
};
type AttachResult = { added: ContinuityAttachment[]; errors: string[] };
type ContinuityCreditSettings = import("./lib/credit").CreditSettings;
declare global {
  interface Window {
    continuity: {
      chooseExport: () => Promise<{ fileName: string; conversations: ContinuityConversation[]; count: number } | null>;
      exportChat: (payload: { fileName: string; data: string }) => Promise<{ canceled: boolean; filePath?: string }>;
      saveApiKey: (key: string) => Promise<boolean>;
      testApiKey: (key: string) => Promise<{ ok: boolean; modelCount: number }>;
      keyStatus: () => Promise<{ configured: boolean; secureStorage: boolean }>;
      loadChats: () => Promise<ContinuityConversation[]>;
      loadUsage: () => Promise<(Partial<ContinuityUsage> & { model: string; inputTokens: number; outputTokens: number; createdAt: string })[]>;
      saveChats: (chats: ContinuityConversation[]) => Promise<boolean>;
      loadCredit: () => Promise<ContinuityCreditSettings | null>;
      saveCredit: (settings: ContinuityCreditSettings) => Promise<ContinuityCreditSettings>;
      loadPrefs: () => Promise<ContinuityPrefs>;
      backupData: () => Promise<{ canceled: true } | { canceled: false; filePath: string; count: number }>;
      restoreData: () => Promise<{ canceled: true } | { canceled: false; count: number; safetyPath: string }>;
      openDataFolder: () => Promise<boolean>;
      focusWindow: () => Promise<boolean>;
      attachmentText: (id: string) => Promise<{ text: string; truncated: boolean }>;
      openAttachmentPdf: (id: string, name: string) => Promise<boolean>;
      appVersion: () => Promise<string>;
      updateStatus: () => Promise<ContinuityUpdateStatus>;
      checkForUpdates: () => Promise<ContinuityUpdateStatus>;
      downloadUpdate: () => Promise<ContinuityUpdateStatus>;
      installUpdate: () => Promise<ContinuityUpdateStatus>;
      onUpdateStatus: (listener: (status: ContinuityUpdateStatus) => void) => () => void;
      summarizeHandoff: (payload: { model: string; title: string; transcript: string }) => Promise<{ text: string; usage: Omit<ContinuityUsage, "createdAt"> }>;
      openHandoff: (payload: { text: string; target: "desktop" | "web" }) => Promise<boolean>;
      savePrefs: (prefs: ContinuityPrefs) => Promise<ContinuityPrefs>;
      loadProjects: () => Promise<ContinuityProject[]>;
      saveProjects: (projects: ContinuityProject[]) => Promise<ContinuityProject[]>;
      pickAttachments: () => Promise<AttachResult>;
      addAttachmentFiles: (files: File[]) => Promise<AttachResult>;
      addAttachmentData: (name: string, data: Uint8Array) => Promise<AttachResult>;
      attachmentPreview: (id: string) => Promise<string | null>;
      listMemory: () => Promise<{ path: string; size: number; content: string }[]>;
      deleteMemory: (path: string) => Promise<boolean>;
      saveGeneratedFile: (fileId: string, name: string) => Promise<{ canceled: boolean; filePath?: string }>;
      mcpInfo: () => Promise<{ serverPath: string; runtimePath: string; dataDir: string; platform: string }>;
      pickMcpFolders: () => Promise<string[]>;
      listModels: () => Promise<ContinuityModel[]>;
      reply: (payload: {
        requestId: string; messages: { role: "user" | "assistant"; content: string; attachments?: ContinuityAttachment[] }[];
        model?: string; effort?: string; style?: string; projectId?: string; tools?: ContinuityTools; containerId?: string; chatId?: string; incognito?: boolean;
      }) => Promise<{
        text: string; thinking: string; aborted: boolean; usage: ContinuityUsage; citations: ContinuityCitation[]; files: ContinuityFile[];
        container?: { id: string; expiresAt?: string }; notices: string[]; steps: ContinuityStep[]; stopReason?: string;
      }>;
      generateTitle: (user: string, assistant: string) => Promise<{ title: string | null; usage: { model: string; inputTokens: number; outputTokens: number } } | null>;
      abortReply: (requestId: string) => Promise<boolean>;
      onStream: (listener: (event: { requestId: string; kind: "text" | "thinking" | "activity"; delta: string }) => void) => () => void;
    };
  }
}
