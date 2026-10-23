import type { pages as Ja } from "../ja/pages";

const chats = (n: number) => `${n} ${n === 1 ? "chat" : "chats"}`;

export const pages: typeof Ja = {
  chats: {
    title: "Your chat history",
    newChat: "New chat",
    search: "Search chats",
    searchPlaceholder: "Search your chats…",
    selectedCount: (n: number) => `${n} selected ${n === 1 ? "chat" : "chats"}`,
    matchCount: (query: string, n: number) => `${chats(n)} matching “${query}”`,
    totalCount: (n: number) => `You have ${n} previous ${n === 1 ? "chat" : "chats"} with Claude`,
    deselectAll: "Deselect all",
    selectAll: "Select all",
    deleteSelected: (n: number) => `Delete ${chats(n)}`,
    select: "Select",
    lastMessage: (when: string) => `Last message ${when}`,
    noMatches: "No chats found."
  },
  projects: {
    title: "Projects",
    newProject: "New project",
    search: "Search projects",
    searchPlaceholder: "Search projects…",
    emptyTitle: "Organize your chats with projects",
    emptyText: "Add instructions and knowledge (PDFs or text) once, and they're included in every chat in the project. Knowledge is cached, so resending it stays cheap.",
    createFirst: "Create your first project",
    noInstructions: "No instructions yet",
    chatCount: (n: number) => chats(n),
    knowledgeCount: (n: number) => `${n} ${n === 1 ? "file" : "files"}`,
    updated: (when: string) => `Updated ${when}`,
    noMatches: "No projects found."
  },
  project: {
    allProjects: "All projects",
    edit: "Edit project",
    start: "Start a chat in this project…",
    lastMessage: "Last message",
    noChats: "No chats yet. Start one above.",
    instructions: "Project instructions",
    instructionsPlaceholder: "Set project instructions to tailor how Claude responds in this project.",
    knowledge: "Project knowledge",
    knowledgeEmpty: "Add PDFs or text files and Claude will reference them in every chat in this project.",
    memory: "Memory",
    memoryOn: "Chats in this project use what Claude has remembered.",
    memoryOff: "Turn it on to let Claude remember context across chats."
  },
  projectModal: {
    newTitle: "New project",
    editTitle: "Project settings",
    name: "Name",
    namePlaceholder: "e.g. Q3 report",
    defaultName: "Project",
    instructions: "Project instructions",
    instructionsPlaceholder: "e.g. You're assisting the corporate planning team at a retail company. Cite the source and point of comparison for every figure, and lead with the conclusion.",
    knowledge: "Project knowledge",
    knowledgeSummary: (n: number, size: string) => `${n} ${n === 1 ? "file" : "files"} · ${size} · included in every chat (cached automatically to keep resending cheap)`,
    knowledgeEmpty: "Add PDFs or text files and Claude will reference them in every chat in this project",
    addFiles: "Add files",
    useMemory: "Use memory in this project",
    memoryHint: "Memories are saved in the memories folder on this device. Review or delete them in Settings → Styles & memory",
    confirmDelete: "Delete this project? Its chats will be kept."
  }
};
