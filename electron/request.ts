import type { ContentBlockParam, MessageParam, ToolUnion } from "@anthropic-ai/sdk/resources/messages";
import type { Attachment } from "./attachments";

export type ChatTurn = { role: "user" | "assistant"; content: string; attachments?: Attachment[] };
export type ToolFlags = { research?: boolean; webSearch?: boolean; webFetch?: boolean; files?: boolean; analysis?: boolean; memory?: boolean; pastChats?: boolean; connectors?: string[] };
export type ModelCaps = { webSearch: boolean; codeExecution: boolean; imageInput: boolean; pdfInput: boolean };
export type Project = { id: string; name: string; instructions: string; knowledge: Attachment[]; memory: boolean };
export type StyleId = "standard" | "concise" | "detailed" | "explanatory" | "custom";

/** Built-in style instructions in the current main-process language. */
export const stylePrompts = (): Record<Exclude<StyleId, "standard" | "custom">, string> => mainT().request.stylePrompts;
import { pastChatsTool } from "./pastChats";
import { officeText } from "./officeText";
import { mainT } from "./i18n";
import { sniffImage } from "./attachments";
export const ANTHROPIC_SKILLS = ["xlsx", "docx", "pptx", "pdf"];

export type Profile = { name?: string; preferences?: string };

export function buildSystem(style: StyleId | undefined, customStyle: string, project?: Project | null, profile?: Profile, options: { research?: boolean } = {}): string | undefined {
  const t = mainT().request;
  const parts: string[] = [];
  const about = [profile?.name?.trim() ? t.userName(profile.name.trim()) : "", profile?.preferences?.trim() ? t.userPreferences(profile.preferences.trim()) : ""].filter(Boolean);
  if (about.length) parts.push(t.aboutUser(about.join("\n")));
  if (style === "custom" && customStyle.trim()) parts.push(customStyle.trim());
  else if (style && style !== "standard" && style !== "custom") parts.push(t.stylePrompts[style]);
  if (project?.instructions.trim()) parts.push(t.projectInstructions(project.name, project.instructions.trim()));
  if (options.research) parts.push(t.researchPrompt);
  return parts.length ? parts.join("\n\n") : undefined;
}

// An image costs up to 4,784 tokens on current models (https://platform.claude.com/docs/en/build-with-claude/vision).
const IMAGE_COST = 4_800;
/** Rough share of the character budget an attachment takes (text files by size; PDFs are not counted). */
export function attachmentCost(turn: ChatTurn): number {
  return (turn.attachments ?? []).reduce((sum, a) => sum + (a.kind === "text" ? a.size : a.kind === "image" ? IMAGE_COST : 0), 0);
}
// Request limits (vision and errors docs): more than 20 images in one request brings a stricter size limit,
// and a request over 32 MB is refused. Files sent inline are base64 (4/3 of their size).
const MAX_IMAGES = 20;
const MAX_INLINE_BYTES = 24 * 1024 * 1024;
const inlineBytes = (turn: ChatTurn) => (turn.attachments ?? []).reduce((sum, a) => sum + (a.kind === "text" ? a.size : a.kind === "image" || a.kind === "pdf" ? Math.ceil(a.size * 4 / 3) : 0), 0);
const imageCount = (turn: ChatTurn) => (turn.attachments ?? []).filter(a => a.kind === "image").length;
// Once history is trimmed, its start moves in steps of this many turns rather than one exchange per turn, so the
// cached prompt prefix stays the same for many turns (otherwise every turn of a long chat is a full cache write).
const TRIM_STEP = 20;

/**
 * Keeps a recent contiguous suffix that starts with a user turn and fits the character budget and the request
 * limits. Text and image attachments count toward the budget, so a large file in an old turn drops out instead of
 * being resent (and overflowing the context) with every later request.
 */
export function selectHistory(turns: ChatTurn[], maxChars = 120_000): ChatTurn[] {
  return selectHistoryRange(turns, maxChars).history;
}

/** Like selectHistory, also giving the index in `turns` where the kept part starts (0 when nothing is left out). */
export function selectHistoryRange(turns: ChatTurn[], maxChars = 120_000): { start: number; history: ChatTurn[] } {
  const filled = (t: ChatTurn) => !!(t.content || t.attachments?.length);
  let remaining = maxChars, images = 0, bytes = 0;
  let start = turns.length;
  let cut: ChatTurn | null = null;
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (!filled(turn)) continue;
    const cost = turn.content.length + attachmentCost(turn);
    if (cost <= remaining && images + imageCount(turn) <= MAX_IMAGES && bytes + inlineBytes(turn) <= MAX_INLINE_BYTES) {
      start = i; remaining -= cost; images += imageCount(turn); bytes += inlineBytes(turn);
    } else {
      // The newest turn alone is too long: keep its end.
      if (start === turns.length) { cut = { ...turn, content: turn.content.slice(-Math.max(remaining, 0)) }; start = i; }
      break;
    }
  }
  const trimmed = turns.slice(0, start).some(filled);
  if (trimmed && !cut) {
    const lastUser = turns.map(t => t.role).lastIndexOf("user");
    const stepped = Math.ceil(start / TRIM_STEP) * TRIM_STEP;
    if (stepped <= lastUser - TRIM_STEP / 2) start = stepped;
  }
  let first = start;
  while (first < turns.length && (!filled(turns[first]) || turns[first].role !== "user")) first++;
  const ordered = turns.slice(first).filter(filled).map(t => (cut && t === turns[start] ? cut : t));
  return { start: first, history: ordered };
}

/** A summary of the turns before `upto` sent in their place: the API's compaction block, or text written by a small model. */
export type HistorySummary = { upto: number; kind: "api"; block: unknown } | { upto: number; kind: "text"; text: string };
export const summaryText = (text: string) => `<conversation_summary>\n${text}\n</conversation_summary>`;

export type AttachmentLoader = {
  read: (attachment: Attachment) => Promise<Buffer>;
  /** Uploads to the Files API (cached) so code execution can read the file. */
  uploadForContainer: (attachment: Attachment) => Promise<string>;
};

export async function attachmentBlocks(attachments: Attachment[], loader: AttachmentLoader, opts: { containerUploads: boolean; caps: ModelCaps }): Promise<{ blocks: ContentBlockParam[]; skipped: string[] }> {
  const t = mainT().request;
  const blocks: ContentBlockParam[] = [];
  const skipped: string[] = [];
  for (const att of attachments) {
    if (att.kind === "image") {
      if (!opts.caps.imageInput) { skipped.push(t.imageUnsupported(att.name)); continue; }
      const bytes = await loader.read(att);
      // Attachments saved before the type was taken from the contents may carry the extension's type.
      const mediaType = sniffImage(bytes) ?? att.mediaType;
      blocks.push({ type: "image", source: { type: "base64", media_type: mediaType as "image/png", data: bytes.toString("base64") } });
    } else if (att.kind === "pdf") {
      if (!opts.caps.pdfInput) { skipped.push(t.pdfUnsupported(att.name)); continue; }
      const data = (await loader.read(att)).toString("base64");
      blocks.push({ type: "document", title: att.name, source: { type: "base64", media_type: "application/pdf", data } });
    } else if (att.kind === "text") {
      const data = (await loader.read(att)).toString("utf8");
      blocks.push({ type: "document", title: att.name, source: { type: "text", media_type: "text/plain", data } });
    }
    // Code execution reads files from the container, so spreadsheets/CSVs also go there when it is on.
    if (opts.containerUploads && (att.kind === "file" || att.kind === "text")) {
      blocks.push({ type: "container_upload", file_id: await loader.uploadForContainer(att) });
    } else if (att.kind === "file") {
      // Word, PowerPoint and Excel files are read as text when code execution is off.
      const data = officeText(att.name, await loader.read(att));
      if (data) blocks.push({ type: "document", title: att.name, source: { type: "text", media_type: "text/plain", data } });
      else skipped.push(t.fileNeedsCode(att.name));
    }
  }
  return { blocks, skipped };
}

/**
 * Character budget for the history sent with a request, from the model's input token limit.
 * 0.6 characters per token stays under the limit even for Japanese (about one token per character)
 * and leaves room for the system prompt, project knowledge and attachments.
 */
export function historyBudget(maxInputTokens: number | undefined): number {
  return maxInputTokens ? Math.min(Math.max(Math.floor(maxInputTokens * 0.6), 60_000), 1_500_000) : 120_000;
}

export async function buildMessages(turns: ChatTurn[], knowledge: Attachment[], loader: AttachmentLoader, opts: { containerUploads: boolean; caps: ModelCaps; maxChars?: number; summary?: HistorySummary | null }): Promise<{ messages: MessageParam[]; skipped: string[]; omitted: number; summarized: number }> {
  const filled = (t: ChatTurn) => !!(t.content || t.attachments?.length);
  const summary = opts.summary ?? null;
  // With a summary, everything from `upto` on is sent as it is (the caller chose `upto` to fit the budget).
  const history = summary ? turns.slice(summary.upto).filter(filled) : selectHistory(turns, opts.maxChars);
  while (summary && history.length && history[0].role !== "user") history.shift();
  const summarized = summary ? turns.slice(0, summary.upto).filter(filled).length : 0;
  const omitted = turns.filter(filled).length - history.length - summarized;
  const skipped: string[] = [];
  const messages: MessageParam[] = [];
  // The compaction block goes first as an assistant message, then the kept turns word for word
  // (https://platform.claude.com/docs/en/build-with-claude/compaction-keep-recent-turns).
  if (summary?.kind === "api") messages.push({ role: "assistant", content: [summary.block as ContentBlockParam] });
  for (let i = 0; i < history.length; i++) {
    const turn = history[i];
    let content: ContentBlockParam[] = [];
    if (turn.role === "user") {
      const extra = [...(i === 0 ? knowledge : []), ...(turn.attachments ?? [])];
      if (extra.length) {
        const built = await attachmentBlocks(extra, loader, opts);
        content.push(...built.blocks);
        skipped.push(...built.skipped);
      }
    }
    if (i === 0 && summary?.kind === "text") content.unshift({ type: "text", text: summaryText(summary.text) });
    if (turn.content) content.push({ type: "text", text: turn.content });
    if (!content.length) content = [{ type: "text", text: mainT().request.attachmentsOnly }];
    const last = messages[messages.length - 1];
    if (last && last.role === turn.role) (last.content as ContentBlockParam[]).push(...content);
    else messages.push({ role: turn.role, content });
  }
  return { messages, skipped: [...new Set(skipped)], omitted: Math.max(0, omitted), summarized };
}

/** Per-request cap for web search and for web fetch in research mode (each search is billed; see the tools menu). */
export const RESEARCH_MAX_USES = 20;

export function buildTools(flags: ToolFlags, caps: ModelCaps): { tools: ToolUnion[]; skills: string[]; unavailable: string[] } {
  const t = mainT().request.unavailable;
  const tools: ToolUnion[] = [];
  const unavailable: string[] = [];
  // Research turns both on with a larger budget: many searches, then reading the most useful pages.
  const uses = flags.research ? RESEARCH_MAX_USES : 5;
  if (flags.webSearch || flags.research) {
    if (caps.webSearch) tools.push({ type: "web_search_20250305", name: "web_search", max_uses: uses });
    else unavailable.push(flags.research ? t.research : t.webSearch);
  }
  if (flags.webFetch || flags.research) {
    if (caps.webSearch) tools.push({ type: "web_fetch_20250910", name: "web_fetch", max_uses: uses });
    else if (!flags.research) unavailable.push(t.webFetch);
  }
  const wantsCode = flags.files || flags.analysis;
  if (wantsCode) {
    if (caps.codeExecution) tools.push({ type: "code_execution_20250825", name: "code_execution" });
    else unavailable.push(flags.files ? t.files : t.analysis);
  }
  if (flags.memory) tools.push({ type: "memory_20250818", name: "memory" });
  if (flags.pastChats) tools.push(pastChatsTool());
  return { tools, skills: flags.files && caps.codeExecution ? ANTHROPIC_SKILLS : [], unavailable };
}

export type Citation = { url: string; title: string; citedText?: string };
export type GeneratedFileRef = { fileId: string };

/** Joins text blocks, appending [n] markers for cited passages, and collects unique sources. */
export function extractText(blocks: unknown[]): { text: string; citations: Citation[] } {
  const citations: Citation[] = [];
  const indexOf = (c: Citation) => {
    const existing = citations.findIndex(x => x.url === c.url);
    if (existing >= 0) return existing + 1;
    citations.push(c);
    return citations.length;
  };
  let text = "";
  for (const block of blocks as { type?: string; text?: string; citations?: unknown[] | null }[]) {
    if (block?.type !== "text" || typeof block.text !== "string") continue;
    text += block.text;
    const markers = new Set<number>();
    for (const c of (block.citations ?? []) as { url?: string; title?: string; cited_text?: string; document_title?: string }[]) {
      if (c?.url) markers.add(indexOf({ url: c.url, title: c.title || c.url, citedText: c.cited_text }));
    }
    if (markers.size) text += [...markers].map(n => `[${n}]`).join("");
  }
  return { text, citations };
}

/** Collects file_ids from code execution results (bash_code_execution_tool_result → content.content[].file_id). */
export function extractFileIds(blocks: unknown[]): string[] {
  const found = new Set<string>();
  const visit = (value: unknown, insideResult: boolean) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(v => visit(v, insideResult)); return; }
    const obj = value as Record<string, unknown>;
    const isResult = typeof obj.type === "string" && obj.type.endsWith("_tool_result");
    if ((insideResult || isResult) && typeof obj.file_id === "string") found.add(obj.file_id);
    for (const child of Object.values(obj)) visit(child, insideResult || isResult);
  };
  visit(blocks, false);
  return [...found];
}

/** Human-readable label for a server tool starting, for the live activity line. */
export function activityLabel(name: string | undefined): string | null {
  const t = mainT().request.activity;
  switch (name) {
    case "web_search": return t.webSearch;
    case "web_fetch": return t.webFetch;
    case "code_execution": case "bash_code_execution": case "text_editor_code_execution": return t.code;
    case "memory": return t.memory;
    case "search_past_chats": return t.pastChats;
    case "search_project_knowledge": return t.knowledge;
    default: return null;
  }
}

export type ToolStep = {
  kind: "search" | "fetch" | "code" | "file" | "memory" | "history" | "knowledge" | "connector" | "other";
  label: string;
  detail?: string;
  output?: string;
  error?: boolean;
  sources?: { url: string; title: string }[];
};
const clip = (value: unknown, max = 4000) => {
  const s = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
  return s.length > max ? s.slice(0, max) + mainT().request.clipped : s;
};

/**
 * Tool calls made while answering, paired with their results, for the expandable "what Claude did" view.
 * Server tools (web search/fetch, code execution) come back as content blocks; client memory results are passed in.
 */
export function extractSteps(blocks: unknown[], clientResults: Map<string, { content: string; isError?: boolean }> = new Map(), connectorNames: Record<string, string> = {}, localTools: Record<string, { server: string; tool: string }> = {}): ToolStep[] {
  const t = mainT().request;
  const results = new Map<string, any>();
  for (const b of blocks as any[]) if (b && typeof b.tool_use_id === "string" && typeof b.type === "string" && b.type.endsWith("_tool_result")) results.set(b.tool_use_id, b);
  const steps: ToolStep[] = [];
  for (const b of blocks as any[]) {
    if (b?.type === "mcp_tool_use") {
      const res = results.get(b.id);
      const text = Array.isArray(res?.content) ? res.content.filter((c: any) => c?.type === "text").map((c: any) => c.text).join("\n") : typeof res?.content === "string" ? res.content : "";
      steps.push({ kind: "connector", label: `${connectorNames[b.server_name] ?? b.server_name ?? t.connector}: ${b.name}`, detail: clip(b.input ?? {}, 2000), ...(text ? { output: clip(text) } : {}), ...(res?.is_error ? { error: true } : {}) });
      continue;
    }
    if (!b || (b.type !== "server_tool_use" && b.type !== "tool_use")) continue;
    const input = b.input ?? {};
    // Tools of local MCP servers run on this PC; their results were recorded as client results.
    const localTool = b.type === "tool_use" ? localTools[b.name] : undefined;
    if (localTool) {
      const own = clientResults.get(b.id);
      steps.push({ kind: "connector", label: `${localTool.server}: ${localTool.tool}`, detail: clip(input, 2000), ...(own ? { output: clip(own.content), ...(own.isError ? { error: true } : {}) } : {}) });
      continue;
    }
    const result = results.get(b.id)?.content;
    const errorCode = result && typeof result === "object" && !Array.isArray(result) && typeof result.error_code === "string" ? result.error_code : undefined;
    if (b.name === "web_search") {
      const list = Array.isArray(result) ? result.filter((r: any) => r?.type === "web_search_result").map((r: any) => ({ url: String(r.url ?? ""), title: String(r.title ?? r.url ?? "") })) : [];
      steps.push({ kind: "search", label: t.searchLabel(clip(input.query, 200)), ...(errorCode ? { error: true, output: t.error(errorCode) } : { sources: list.slice(0, 20), output: t.resultCount(list.length) }) });
    } else if (b.name === "web_fetch") {
      const title = result?.content?.title ?? result?.url ?? input.url;
      steps.push({ kind: "fetch", label: t.fetchLabel, detail: clip(input.url, 500), ...(errorCode ? { error: true, output: t.error(errorCode) } : { output: clip(title, 300) }) });
    } else if (b.name === "bash_code_execution" || b.name === "code_execution") {
      const out = [result?.stdout ? clip(result.stdout) : "", result?.stderr ? "[stderr]\n" + clip(result.stderr, 2000) : ""].filter(Boolean).join("\n");
      steps.push({ kind: "code", label: t.codeLabel, detail: clip(input.command ?? input.code), ...(errorCode ? { error: true, output: t.error(errorCode) } : { output: out || (typeof result?.return_code === "number" ? t.exitCode(result.return_code) : ""), ...(result?.return_code ? { error: true } : {}) }) });
    } else if (b.name === "text_editor_code_execution") {
      const command = String(input.command ?? "");
      steps.push({ kind: "file", label: `${t.textEditorLabels[command] ?? t.fileOp}: ${clip(input.path, 300)}`, ...(command === "create" && input.file_text ? { detail: clip(input.file_text) } : {}),
        ...(errorCode ? { error: true, output: t.error(errorCode) } : result?.content && typeof result.content === "string" ? { output: clip(result.content) } : {}) });
    } else if (b.name === "memory") {
      const own = clientResults.get(b.id);
      steps.push({ kind: "memory", label: `${t.memoryLabels[String(input.command)] ?? t.memoryOp}${input.path ? `: ${clip(input.path, 300)}` : ""}`, ...(own ? { output: clip(own.content), ...(own.isError ? { error: true } : {}) } : {}) });
    } else if (b.name === "search_project_knowledge") {
      const own = clientResults.get(b.id);
      steps.push({ kind: "knowledge", label: t.knowledgeSearch(clip(input.query, 200)), ...(own ? { output: clip(own.content), ...(own.isError ? { error: true } : {}) } : {}) });
    } else if (b.name === "search_past_chats") {
      const own = clientResults.get(b.id);
      steps.push({ kind: "history", label: t.historySearch(clip(input.query, 200)), ...(own ? { output: clip(own.content), ...(own.isError ? { error: true } : {}) } : {}) });
    } else {
      steps.push({ kind: "other", label: String(b.name ?? t.tool), detail: clip(input, 2000) });
    }
  }
  return steps;
}
