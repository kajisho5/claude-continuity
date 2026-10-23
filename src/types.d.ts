export {};
type ContinuityMessage = {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  model?: string;
  costUsd?: number;
  aborted?: boolean;
};
type ContinuityConversation = { id: string; title: string; messages: ContinuityMessage[]; source?: string };
type ContinuityUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
};
type ContinuityModel = {
  id: string;
  displayName: string;
  createdAt?: string;
  maxTokens?: number;
  maxInputTokens?: number;
  effortLevels: string[];
  adaptiveThinking: boolean;
};
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
      listModels: () => Promise<ContinuityModel[]>;
      reply: (payload: { requestId: string; messages: { role: "user" | "assistant"; content: string }[]; model?: string; effort?: string }) => Promise<{
        text: string; thinking: string; aborted: boolean; usage: ContinuityUsage; contextMessages?: number; contextCharacters?: number;
      }>;
      abortReply: (requestId: string) => Promise<boolean>;
      onStream: (listener: (event: { requestId: string; kind: "text" | "thinking"; delta: string }) => void) => () => void;
    };
  }
}
