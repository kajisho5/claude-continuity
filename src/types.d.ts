export {};
declare global {
  interface Window {
    continuity: {
      chooseExport: () => Promise<{ filePath: string; fileName: string } | null>;
      saveApiKey: (key: string) => Promise<boolean>;
      keyStatus: () => Promise<{ configured: boolean; secureStorage: boolean }>;
      reply: (payload: { messages: { role: "user" | "assistant"; content: string }[]; model?: string }) => Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; model: string } }>;
    };
  }
}
