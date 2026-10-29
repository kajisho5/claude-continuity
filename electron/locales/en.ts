import type { ja as Ja } from "./ja";

export const en: typeof Ja = {
  attachments: {
    badId: "Invalid attachment ID.",
    empty: (name: string) => `${name} is an empty file.`,
    tooLarge: (name: string) => `${name} is too large (limit 32 MB).`,
    imageTooLarge: (name: string) => `${name} exceeds the 10 MB limit for images.`,
    textTooLarge: (name: string) => `${name} exceeds the 2 MB limit for text files.`,
    notFile: (name: string) => `${name} is not a file.`
  },
  backup: {
    notBackup: "This is not a Claude Continuity backup file.",
    unsupportedFormat: "This backup format is not supported. Please update the app.",
    unexpectedFile: (name: string) => `The backup contains an unexpected file: ${name}`,
    fileTooLarge: (rel: string) => `File is too large: ${rel}`,
    totalTooLarge: "The backup is too large overall (limit 2 GB).",
    corrupt: (rel: string) => `${rel} is corrupted.`,
    badPath: (rel: string) => `Invalid path: ${rel}`
  },
  connectors: {
    nameRequired: "Name is required.",
    badUrl: "Enter a valid URL.",
    httpsOnly: "The URL must start with https:// (the API can only reach publicly exposed HTTPS MCP servers).",
    noCredentialsInUrl: "Don't put credentials in the URL. Use the token field instead.",
    notFound: "Connector not found.",
    tokenStorageUnavailable: "Tokens cannot be stored securely in this environment.",
    connectFailed: (message: string) => `Could not connect: ${message}`
  },
  localMcp: {
    inputCut: (n: number) => `(${n.toLocaleString("en-US")} more characters not shown)`,
    commandRequired: "Enter a command.",
    badEnv: (key: string) => `Invalid environment variable name: ${key}`,
    truncated: "\n…(truncated)",
    emptyResult: "(no result)",
    startTimeout: "The server didn't start within 60 seconds.",
    startFailed: (name: string, message: string, stderr: string) => `Couldn't start ${name}: ${message}${stderr ? `\n${stderr}` : ""}`,
    denied: "The user did not allow this tool to run.",
    callFailed: (message: string) => `The tool failed: ${message}`,
    unavailable: (name: string, message: string) => `Couldn't use the local MCP server "${name}" (${message})`,
    configNotFound: (file: string) => `Claude Desktop config file not found: ${file}`,
    configInvalid: "Couldn't read the Claude Desktop config file (invalid JSON).",
    envStorageUnavailable: "Environment variables can't be stored securely on this system.",
    starting: (name: string) => `Starting ${name}…`,
    usingTool: (server: string, tool: string) => `Using ${tool} from ${server}…`,
    waitingApproval: (server: string, tool: string) => `Waiting for permission to run ${tool} from ${server}…`
  },
  skills: {
    pickTitle: "Choose a skill (a folder with SKILL.md, or a .zip)",
    unsupported: "Choose a skill folder, a SKILL.md, or a .zip / .skill file.",
    noSkillMd: "No SKILL.md found. A skill needs SKILL.md at the top of its folder.",
    tooLarge: "The skill is too large (30 MB in total at most).",
    tooManyFiles: "Too many files (500 at most).",
    badArchive: "This .zip can't be read safely (it has paths pointing outside its folder)."
  },
  knowledge: {
    toolDescription: "Searches this project's knowledge (the text files added to it) and returns the most relevant passages. The knowledge is too large to include in full, so search it before answering questions about it, rephrasing and searching again when needed.",
    queryDescription: "Keywords or a short phrase to look for",
    maxResultsDescription: "Maximum number of passages to return (1-12, default 6)",
    noHits: "No matching passages. Try different words.",
    hitHeading: (name: string, part: number) => `[${name} · part ${part}]`,
    systemNote: (names: string) => `# Project knowledge\nThese files are too large to send in full. Use search_project_knowledge when you need their content:\n${names}`
  },
  memory: {
    viewTruncated: "\n…(truncated because it is long; use view_range to see the rest)"
  },
  pastChats: {
    toolDescription: "Searches the user's past conversations (the history saved in this app) by keyword and returns the title, date and an excerpt of each matching conversation. Use it only when the user explicitly refers to an earlier conversation (for example \"what we discussed before\"). Otherwise do not use it; just answer.",
    queryDescription: "Keywords for what to look for (separate several with spaces)",
    maxResultsDescription: "Maximum number of conversations to return (1–10, default 5)",
    noHits: "No matching past conversations were found.",
    hitHeading: (n: number, title: string, date?: string) => `${n}. "${title}"${date ? ` (${date})` : ""}`
  },
  request: {
    appContext: (on: string[], off: string[]) => [
      "# About this app",
      "This conversation takes place in Claude Continuity, a desktop app that uses the Anthropic API.",
      "- The user can attach files (images, PDFs, text, code and more) with the composer's \"+\" button, drag and drop or paste, and can send screenshots. Attached files reach this conversation.",
      "- Tools are turned on and off in the composer's tools menu.",
      on.length ? `- Tools available for this reply: ${on.join(", ")}` : "- No tools are available for this reply.",
      off.length ? `- Tools that are off: ${off.join(", ")}. When a request needs one of them, don't say you can't; tell the user to turn it on in the tools menu.` : ""
    ].filter(Boolean).join("\n"),
    toolNames: { webSearch: "Web search", webFetch: "Read URLs", files: "File creation (Skills)", analysis: "Data analysis (code execution)", research: "Research", memory: "Memory" },
    stylePrompts: {
      concise: "Keep your answers concise. Lead with the conclusion and key points, and skip preambles, repetition and unnecessary extras.",
      detailed: "Give detailed answers. Explain carefully, including background, reasoning, concrete examples and caveats.",
      explanatory: "Explain in a teaching tone. Break down technical terms and build understanding step by step from the basics."
    },
    userName: (name: string) => `What to call the user: ${name}`,
    userPreferences: (text: string) => `What the user wants considered in every conversation:\n${text}`,
    aboutUser: (lines: string) => `# About the user\n${lines}`,
    projectInstructions: (name: string, text: string) => `# Instructions for the project "${name}"\n${text}`,
    imageUnsupported: (name: string) => `${name} (this model does not support images)`,
    pdfUnsupported: (name: string) => `${name} (this model does not support PDFs)`,
    fileNeedsCode: (name: string) => `${name} (turn on "Data analysis" or "File creation" to read it)`,
    attachmentsOnly: "(attachments only)",
    researchPrompt: [
      "# Research mode",
      "The user asked for research. Investigate thoroughly with repeated web searches and page fetches before answering.",
      "- First list the angles the answer needs, then search several times per angle with varied queries.",
      "- Don't rely on search snippets: fetch and read reliable primary sources (official sites and documentation, papers, government or institutional material).",
      "- Where sources disagree, say so and give both. Don't fill gaps with guesses; state what you could not confirm.",
      "- For time-sensitive facts, say as of when they hold.",
      "- When done, write a report with headings: the conclusion and key points first, then details per angle, then remaining uncertainties.",
      "- Cite sources for your claims."
    ].join("\n"),
    researchProgress: (searches: number, fetches: number) => `Researching… ${searches} ${searches === 1 ? "search" : "searches"} · ${fetches} ${fetches === 1 ? "page" : "pages"}`,
    unavailable: { research: "Research", webSearch: "Web search", webFetch: "URL fetching", files: "File creation", analysis: "Data analysis" },
    activity: {
      webSearch: "Searching the web…",
      webFetch: "Fetching page…",
      code: "Running code…",
      memory: "Checking memory…",
      knowledge: "Searching project knowledge…",
      pastChats: "Searching past chats…"
    },
    clipped: "\n…(truncated)",
    textEditorLabels: { view: "Viewed file", create: "Created file", str_replace: "Edited file", insert: "Added to file" },
    memoryLabels: { view: "Checked memory", create: "Saved to memory", str_replace: "Updated memory", insert: "Added to memory", delete: "Deleted memory", rename: "Renamed memory" },
    connector: "Connector",
    searchLabel: (query: string) => `Searched the web for "${query}"`,
    error: (code: string) => `Error: ${code}`,
    resultCount: (n: number) => `${n} ${n === 1 ? "result" : "results"}`,
    fetchLabel: "Fetched page",
    codeLabel: "Ran code",
    exitCode: (code: number) => `Exit code ${code}`,
    fileOp: "File operation",
    memoryOp: "Memory operation",
    knowledgeSearch: (query: string) => `Searched knowledge: ${query}`,
    historySearch: (query: string) => `Searched past chats for "${query}"`,
    tool: "Tool"
  },
  updater: {
    devBuild: "Development builds don't check for updates.",
    unavailable: "Automatic updates are not available in this environment.",
    unsupportedFormat: "Automatic updates are not available for this distribution format. Please use the installer version.",
    availableTitle: "Update available",
    availableBody: (version: string) => `Claude Continuity ${version} is available. Click to open the app and download it.`,
    readyTitle: "Update ready",
    readyBody: (version: string) => `Relaunch to update to version ${version}.`
  },
  compaction: {
    summarizing: "Summarizing earlier messages…",
    attachments: (names: string) => `[Attached: ${names}]`,
    start: "(Start of the conversation)",
    system: "You keep the record of a conversation. Summarize the conversation you are given (and the earlier summary, if any) so that nothing the rest of the conversation needs is lost: the goal, what was decided, numbers and names, the user's preferences and instructions, and open questions. Use English headings and bullet points. No preamble.",
    request: (previous: string, transcript: string) => `${previous ? `<previous_summary>\n${previous}\n</previous_summary>\n\n` : ""}<conversation>\n${transcript}\n</conversation>\n\nWrite a summary of ${previous ? "the earlier summary together with this continuation of the conversation" : "this conversation"}.`,
    user: "User",
    assistant: "Assistant",
    noticeSummarized: (n: number) => `${n} earlier messages were sent as a summary`
  },
  batch: {
    noLocal: (names: string) => `Left out tools that run on this computer, which Batch can't use: ${names}`,
    noKnowledgeSearch: "Batch can't search project knowledge, so the large knowledge files were not sent",
    notFound: "This batch was not found.",
    expired: "Not processed within 24 hours (not billed)",
    canceled: "Canceled",
    errored: (message: string) => `Couldn't be processed: ${message}`,
    notifyTitle: "A batch reply arrived",
    tooOld: "Past the 29-day result retention"
  },
  main: {
    shortcutTaken: (keys: string) => `${keys} is already used by another app. Choose a different combination.`,
    captureFailed: "Couldn't capture the screen. On macOS, allow this app under System Settings > Privacy & Security > Screen Recording.",
    importedChat: "Imported conversation",
    exportHtmlTitle: "Export conversation as HTML",
    exportJsonTitle: "Export conversation as JSON",
    importTitle: "Select Claude export data",
    allFiles: "All files",
    jsonTooLarge: "The JSON file is too large (limit 50 MB).",
    badChats: "The conversation data is not in the expected format.",
    chat: "Conversation",
    backupTitle: "Back up all data",
    restoreTitle: "Restore from backup",
    backupFileTooLarge: "The backup file is too large (limit 2 GB).",
    zipOpenFailed: "Could not open the ZIP file.",
    mcpFolderTitle: "Choose folders the MCP server can read",
    keyStorageUnavailable: "Secure key storage is not available in this environment.",
    reloadingAfterRestore: "The data was just restored; the window is reloading.",
    badKey: "Check the format of your Anthropic API key.",
    secureStorageUnavailable: "Secure key storage is not available.",
    badKeyPrefix: "Check the format of your Anthropic API key (it starts with sk-ant-).",
    badCredit: "The credit settings are not in the expected format.",
    badPlan: "Invalid plan value.",
    badAmount: "Enter a monthly credit amount between 0 and 10,000 USD.",
    badResetDay: "Enter a grant day between 1 and 31.",
    badCalibration: "Invalid calibration value.",
    styleName: (n: number) => `Style ${n}`,
    customStyleName: "Custom",
    badProjects: "The project data is not in the expected format.",
    project: "Project",
    attachTitle: "Attach files",
    notPdf: "This is not a PDF file.",
    badFileId: "Invalid file ID.",
    saveFileTitle: "Save generated file",
    noTurns: "There is no conversation to send.",
    noUserMessage: "There is no user message.",
    externalTool: "external tool",
    usingConnector: (name: string) => `Using connector (${name})…`,
    noticeOmitted: (n: number) => `${n} older ${n === 1 ? "message was" : "messages were"} not sent because of the model's limit`,
    noticeRoundFailed: (msg: string) => `The reply stopped partway because a request failed (${msg}); continue to pick it up`,
    noticeSkipped: (detail: string) => `Skipped attachment: ${detail}`,
    noticeUnavailable: (feature: string) => `${feature} is not available with this model`,
    handoffSystem: `You write handoff notes for conversations. Read the conversation record you are given and summarize it in English under the following headings, in this order, so that another Claude can continue the work from this note alone.
## Goal
## Decisions and assumptions so far
## Current state (latest deliverables or conclusions; do not omit important code, numbers or proper nouns)
## Open issues and next steps
On the last line, write "Please help me continue from here, based on the above." Keep the whole note under 2,500 characters. Do not add facts that are not in the conversation.`,
    handoffUser: (title: string, transcript: string) => `Conversation title: ${title}\n\n<conversation>\n${transcript}\n</conversation>`,
    handoffIntro: (title: string, text: string) => `This is a handoff note for the conversation "${title}", which I had been continuing in another app (Claude API).\n\n${text}`,
    handoffEmpty: "There’s nothing to hand off.",
    handoffTooLong: "This is too long to open. Shorten it and try again.",
    sampleTooShort: "The writing sample is too short (at least 40 characters).",
    styleFromSampleSystem: "Analyze how the given writing sample is written (tone, sentence length, structure, use of symbols and bullet points, handling of technical terms, distance from the reader) and write instructions in English that let another AI reproduce that writing style. Do not mention the content or specific facts; describe only the style, as 5–10 bullet points in the imperative. No preamble.",
    titleSystem: "Output exactly one English title of at most 6 words that describes the conversation. No symbols, quotation marks or explanations.",
    titleUser: (user: string, assistant: string) => `User: ${user}\n\nAssistant: ${assistant}`
  }
};
