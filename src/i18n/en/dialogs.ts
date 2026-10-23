import type { dialogs as Ja } from "../ja/dialogs";

export const dialogs: typeof Ja = {
  shortcuts: {
    title: "Keyboard shortcuts",
    newChat: "New chat",
    searchChats: "Search chats",
    focusInput: "Focus the message box",
    toggleSidebar: "Toggle sidebar",
    send: "Send",
    newline: "New line",
    stopOrClose: "Stop the reply / close a panel or dialog",
    showShortcuts: "Show these shortcuts"
  },
  rename: {
    title: "Rename chat",
    label: "Chat name"
  },
  handoff: {
    title: "Continue in the Claude app",
    intro: "Opens a new chat in the Claude desktop app with this conversation's context already filled in. Review it in the app before you send it. Attachments and files Claude created aren't carried over.",
    modeSummary: "Summarize (recommended)",
    modeTranscript: "Recent messages as-is",
    summaryExplain: "Uses the API to turn the whole conversation into a handoff note: goals, decisions, where things stand, and next steps.",
    summaryCost: (model: string) => `This uses ${model} and a small amount of API credit.`,
    summarizing: "Summarizing…",
    createSummary: "Create handoff note",
    needsKey: "Add an API key to use this.",
    contentLabel: "Content to hand off",
    chars: (n: string) => `${n} characters`,
    overWindows: " · Too long for a Windows link, so the end will be trimmed",
    over: " · Over the limit, so the end will be trimmed",
    included: (included: number, total: number) => `Includes the latest ${included} of ${total} messages`,
    regenerating: "Creating…",
    regenerate: "Regenerate",
    openWeb: "Open claude.ai in browser",
    openDesktop: "Open in Claude Desktop",
    summaryFailed: (error: string) => "Couldn't create the summary: " + error,
    copiedForWeb: "Copied. Paste it into the message box on claude.ai and send",
    openedDesktop: "Opened in the Claude app. Review it, then send",
    openedClipped: "It was too long, so the end was trimmed",
    openFailed: (error: string) => "Couldn't open the Claude app: " + error
  }
};
