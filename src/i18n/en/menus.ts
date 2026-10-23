import type { menus as Ja } from "../ja/menus";

export const menus: typeof Ja = {
  chat: {
    menuFor: (title: string) => `Menu for ${title}`,
    star: "Star",
    unstar: "Unstar",
    rename: "Rename",
    moveToProject: "Add to project",
    noProject: "No project",
    exportJson: "Export as JSON",
    exportHtml: "Export as HTML (for sharing)"
  },
  account: {
    defaultName: "User",
    keyConfigured: "API key added",
    keyMissing: "No API key",
    settings: "Settings",
    shortcuts: "Keyboard shortcuts",
    importExport: "Import exported data",
    redoOnboarding: "Redo setup"
  },
  model: {
    select: "Select model",
    fetching: "Loading…",
    models: "Model",
    describeOpus: "Most capable for complex work",
    describeSonnet: "Smart and efficient for everyday tasks",
    describeHaiku: "Fastest model for quick answers",
    effort: "Thinking effort",
    effortHint: "More effort means better answers but uses more credit",
    refresh: "Refresh model list"
  },
  tools: {
    tools: "Tools",
    webSearchTitle: "Web search",
    webSearchDesc: "Search the web for up-to-date info, with citations · $10 per 1,000 searches",
    webSearchChip: "Web search",
    webFetchTitle: "Web fetch",
    webFetchDesc: "Read the content of URLs that come up in the chat",
    webFetchChip: "Web fetch",
    filesTitle: "File creation (Skills)",
    filesDesc: "Create Excel, Word, PowerPoint and PDF files",
    filesChip: "Files",
    analysisTitle: "Data analysis",
    analysisDesc: "Analyze attached CSV or Excel files with Python",
    analysisChip: "Analysis",
    memoryTitle: "Memory",
    memoryDesc: "Remember context across chats (review or delete it in Settings)",
    memoryChip: "Memory",
    styleTip: (style: string) => `Style: ${style} (click to switch back to Normal)`,
    styleAria: (style: string) => `Style ${style}`,
    onByProjectTip: (chip: string) => `${chip} (on in project settings)`,
    clickToTurnOff: (name: string) => `${name} (click to turn off)`,
    useStyle: "Use style",
    standard: "Normal",
    onByProject: "On in project settings",
    connectors: "Connectors",
    useInThisChat: "Use in this chat",
    manageConnectors: "Manage connectors",
    addConnectors: "Add connectors (Notion, internal MCP servers and more)"
  }
};
