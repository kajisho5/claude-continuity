export {};
type ContinuityMessage = { role: "user" | "assistant"; content: string };
type ContinuityConversation = { id: string; title: string; messages: ContinuityMessage[]; source?: string };
declare global {
  interface Window {
    continuity: {
      chooseExport: () => Promise<{ fileName: string; conversations: ContinuityConversation[]; count: number } | null>;
      saveApiKey: (key: string) => Promise<boolean>;
      keyStatus: () => Promise<{ configured: boolean; secureStorage: boolean }>;
      loadChats: () => Promise<ContinuityConversation[]>;
      saveChats: (chats: ContinuityConversation[]) => Promise<boolean>;
      reply: (payload: { messages: ContinuityMessage[]; model?: string }) => Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; model: string } }>;
    };
  }
}
