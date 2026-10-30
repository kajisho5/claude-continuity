export {};
type ContinuityAttachment = { id: string; name: string; mediaType: string; size: number; kind: "image" | "pdf" | "text" | "file" };
type ContinuityCitation = { url: string; title: string; citedText?: string };
type ContinuityFile = { fileId: string; name: string; size?: number };
type ContinuityReply = {
  content: string; thinking?: string; model?: string; costUsd?: number; aborted?: boolean;
  citations?: ContinuityCitation[]; files?: ContinuityFile[]; steps?: ContinuityStep[]; stopReason?: string;
};
type ContinuityStep = import("./lib/steps").ToolStep;
type ContinuityConnector = import("./lib/connectors").ConnectorView;
type ContinuityUpdateStatus = import("./lib/update").UpdateStatus;
type ContinuityMessage = ContinuityReply & {
  role: "user" | "assistant";
  attachments?: ContinuityAttachment[];
  alternates?: ContinuityReply[];
  altIndex?: number;
};
type ContinuityTools = { research?: boolean; webSearch?: boolean; webFetch?: boolean; files?: boolean; analysis?: boolean; memory?: boolean; batch?: boolean; connectors?: string[] };
/** A chat's summary of its older turns (electron/compaction.ts). */
type ContinuitySummary = { upto: number; fingerprint: string; kind: "api" | "text"; block?: Record<string, unknown>; text: string; model: string; createdAt: string };
type ContinuityReplyPayload = {
  requestId: string; messages: { role: "user" | "assistant"; content: string; attachments?: ContinuityAttachment[] }[];
  model?: string; effort?: string; style?: string; projectId?: string; tools?: ContinuityTools; containerId?: string; chatId?: string; incognito?: boolean;
  compaction?: ContinuitySummary;
};
type ContinuityReplyResult = {
  text: string; thinking: string; aborted?: boolean; usage: ContinuityUsage; costUsd?: number | null; citations: ContinuityCitation[]; files: ContinuityFile[];
  container?: { id: string; expiresAt?: string }; notices?: string[]; steps: ContinuityStep[]; stopReason?: string; compaction?: ContinuitySummary;
};
type ContinuityBatchJob = {
  id: string; chatId: string; chatTitle: string; model: string; createdAt: string; status: "pending" | "done" | "expired" | "canceled" | "errored";
  endedAt?: string; estimateUsd?: number; costUsd?: number; error?: string; canceling?: boolean; result?: ContinuityReplyResult;
};
type ContinuityConversation = {
  id: string; title: string; messages: ContinuityMessage[]; source?: string;
  projectId?: string; style?: string; tools?: ContinuityTools; container?: { id: string; expiresAt?: string }; compaction?: ContinuitySummary;
};
type ContinuityProject = { id: string; name: string; instructions: string; knowledge: ContinuityAttachment[]; memory: boolean };
type ContinuityPrefs = import("./lib/prefs").Prefs;
type ContinuityUsage = {
  model: string; inputTokens: number; outputTokens: number;
  cacheCreationInputTokens: number; cacheReadInputTokens: number; webSearchRequests?: number; source?: string; batch?: boolean;
};
type ContinuityModel = {
  id: string; displayName: string; createdAt?: string; maxTokens?: number; maxInputTokens?: number;
  effortLevels: string[]; adaptiveThinking: boolean; webSearch: boolean; codeExecution: boolean; imageInput: boolean; pdfInput: boolean;
};
type AttachResult = { added: ContinuityAttachment[]; errors: string[] };
type ContinuityBrowserState = { url: string; title: string; canGoBack: boolean; canGoForward: boolean; loading: boolean; error: string };
type ContinuityCreditSettings = import("./lib/credit").CreditSettings;
declare global {
  interface Window {
    continuity: {
      chooseExport: () => Promise<{ fileName: string; conversations: ContinuityConversation[]; count: number } | null>;
      exportChat: (payload: { fileName: string; data: string; format?: "json" | "html" }) => Promise<{ canceled: boolean; filePath?: string }>;
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
      captureScreen: () => Promise<AttachResult>;
      shortcutStatus: () => Promise<string>;
      onQuick: (listener: () => void) => () => void;
      listConnectors: () => Promise<ContinuityConnector[]>;
      saveConnector: (input: { id?: string; name: string; enabled?: boolean; transport?: "remote" | "local"; url?: string; token?: string | null; command?: string; args?: string; env?: string | null }) => Promise<ContinuityConnector[]>;
      listSkills: () => Promise<{ id: string; name: string; updatedAt: string }[]>;
      uploadSkill: (kind: "folder" | "file") => Promise<{ id: string; name: string; updatedAt: string } | null>;
      deleteSkill: (id: string) => Promise<boolean>;
      importDesktopConnectors: () => Promise<{ list: ContinuityConnector[]; added: number; found: number; file: string }>;
      resetAllowedTools: (id: string) => Promise<ContinuityConnector[]>;
      setConnectorEnabled: (id: string, enabled: boolean) => Promise<ContinuityConnector[]>;
      answerApproval: (approvalId: string, decision: import("./lib/connectors").ApprovalDecision) => Promise<boolean>;
      onApproval: (listener: (approval: import("./lib/connectors").ToolApproval) => void) => () => void;
      deleteConnector: (id: string) => Promise<ContinuityConnector[]>;
      testConnector: (id: string) => Promise<{ tools: string[] }>;
      styleFromSample: (payload: { sample: string; model: string }) => Promise<{ prompt: string; usage: Omit<ContinuityUsage, "createdAt"> }>;
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
      browser: {
        open: (url: string) => Promise<ContinuityBrowserState>;
        layout: (bounds: { x: number; y: number; width: number; height: number }, visible: boolean) => Promise<void>;
        state: () => Promise<ContinuityBrowserState>;
        back: () => Promise<void>; forward: () => Promise<void>; reload: () => Promise<void>; stop: () => Promise<void>;
        openExternal: () => Promise<void>; close: () => Promise<void>; clearData: () => Promise<void>;
        attachPage: () => Promise<AttachResult>; attachCapture: () => Promise<AttachResult>;
        onState: (listener: (state: ContinuityBrowserState) => void) => () => void;
        onOpenRequest: (listener: (url: string) => void) => () => void;
      };
      addAttachmentFiles: (files: File[]) => Promise<AttachResult>;
      addAttachmentData: (name: string, data: Uint8Array) => Promise<AttachResult>;
      attachmentPreview: (id: string, full?: boolean) => Promise<string | null>;
      listMemory: () => Promise<{ path: string; size: number; content: string }[]>;
      deleteMemory: (path: string) => Promise<boolean>;
      writeMemory: (path: string, text: string) => Promise<boolean>;
      saveGeneratedFile: (fileId: string, name: string) => Promise<{ canceled: boolean; filePath?: string }>;
      mcpInfo: () => Promise<{ serverPath: string; runtimePath: string; dataDir: string; platform: string; unstable?: boolean }>;
      pickMcpFolders: () => Promise<string[]>;
      listModels: () => Promise<ContinuityModel[]>;
      reply: (payload: ContinuityReplyPayload) => Promise<ContinuityReplyResult & { aborted: boolean; notices: string[] }>;
      estimate: (payload: ContinuityReplyPayload) => Promise<{ model: string; inputTokens: number; maxOutputTokens: number; withoutTools: boolean }>;
      createBatch: (payload: ContinuityReplyPayload & { chatTitle: string; estimateUsd?: number }) => Promise<{ job: ContinuityBatchJob; notices: string[]; compaction?: ContinuitySummary; summaryCostUsd?: number }>;
      listBatches: () => Promise<ContinuityBatchJob[]>;
      cancelBatch: (id: string) => Promise<ContinuityBatchJob[]>;
      ackBatch: (id: string) => Promise<ContinuityBatchJob[]>;
      clearBatches: () => Promise<ContinuityBatchJob[]>;
      onBatchUpdate: (listener: (jobs: ContinuityBatchJob[]) => void) => () => void;
      generateTitle: (user: string, assistant: string) => Promise<{ title: string | null; usage: { model: string; inputTokens: number; outputTokens: number } } | null>;
      abortReply: (requestId: string) => Promise<boolean>;
      onStream: (listener: (event: { requestId: string; kind: "text" | "thinking" | "activity"; delta: string }) => void) => () => void;
    };
  }
}
