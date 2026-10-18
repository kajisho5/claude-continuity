export {};
type ContinuityMessage = { role: "user" | "assistant"; content: string };
type ContinuityConversation = { id: string; title: string; messages: ContinuityMessage[]; source?: string };
declare global {
  interface Window {
    continuity: {
      chooseExport: () => Promise<{ fileName: string; conversations: ContinuityConversation[]; count: number } | null>;
      exportChat: (payload: { fileName: string; data: string }) => Promise<{ canceled: boolean; filePath?: string }>;
      saveApiKey: (key: string) => Promise<boolean>;
      keyStatus: () => Promise<{ configured: boolean; secureStorage: boolean }>;
      loadChats: () => Promise<ContinuityConversation[]>;
      loadUsage: () => Promise<{ model: string; inputTokens: number; outputTokens: number; createdAt: string }[]>;
      saveChats: (chats: ContinuityConversation[]) => Promise<boolean>;
      listModels: () => Promise<{ id: string; displayName: string; createdAt?: string }[]>;
      reply: (payload: { messages: ContinuityMessage[]; model?: string }) => Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; model: string }; contextMessages?: number; contextCharacters?: number }>;
    };
  }
}
