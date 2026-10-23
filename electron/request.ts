import type { ContentBlockParam, MessageParam, ToolUnion } from "@anthropic-ai/sdk/resources/messages";
import type { Attachment } from "./attachments";

export type ChatTurn = { role: "user" | "assistant"; content: string; attachments?: Attachment[] };
export type ToolFlags = { webSearch?: boolean; webFetch?: boolean; files?: boolean; analysis?: boolean; memory?: boolean };
export type ModelCaps = { webSearch: boolean; codeExecution: boolean; imageInput: boolean; pdfInput: boolean };
export type Project = { id: string; name: string; instructions: string; knowledge: Attachment[]; memory: boolean };
export type StyleId = "standard" | "concise" | "detailed" | "explanatory" | "custom";

export const STYLE_PROMPTS: Record<Exclude<StyleId, "standard" | "custom">, string> = {
  concise: "回答は簡潔にしてください。結論と要点を先に述べ、前置き・繰り返し・不要な補足は省いてください。",
  detailed: "回答は詳しくしてください。背景、根拠、具体例、注意点まで含めて丁寧に説明してください。",
  explanatory: "教える口調で説明してください。専門用語は噛み砕き、前提から段階を追って理解できるようにしてください。"
};
export const ANTHROPIC_SKILLS = ["xlsx", "docx", "pptx", "pdf"];

export type Profile = { name?: string; preferences?: string };

export function buildSystem(style: StyleId | undefined, customStyle: string, project?: Project | null, profile?: Profile): string | undefined {
  const parts: string[] = [];
  const about = [profile?.name?.trim() ? `ユーザーの呼び名: ${profile.name.trim()}` : "", profile?.preferences?.trim() ? `ユーザーが全会話で考慮してほしいこと:\n${profile.preferences.trim()}` : ""].filter(Boolean);
  if (about.length) parts.push(`# ユーザーについて\n${about.join("\n")}`);
  if (style === "custom" && customStyle.trim()) parts.push(customStyle.trim());
  else if (style && style !== "standard" && style !== "custom") parts.push(STYLE_PROMPTS[style]);
  if (project?.instructions.trim()) parts.push(`# プロジェクト「${project.name}」の指示\n${project.instructions.trim()}`);
  return parts.length ? parts.join("\n\n") : undefined;
}

/** Keeps a recent contiguous suffix within a character budget that starts with a user turn. */
export function selectHistory(turns: ChatTurn[], maxChars = 120_000): ChatTurn[] {
  const picked: ChatTurn[] = [];
  let remaining = maxChars;
  for (let i = turns.length - 1; i >= 0 && remaining > 0; i--) {
    const turn = turns[i];
    if (!turn.content && !turn.attachments?.length) continue;
    if (turn.content.length <= remaining) { picked.push(turn); remaining -= turn.content.length; }
    else if (picked.length === 0) { picked.push({ ...turn, content: turn.content.slice(-remaining) }); remaining = 0; }
    else break;
  }
  const ordered = picked.reverse();
  while (ordered.length && ordered[0].role !== "user") ordered.shift();
  return ordered;
}

export type AttachmentLoader = {
  read: (attachment: Attachment) => Promise<Buffer>;
  /** Uploads to the Files API (cached) so code execution can read the file. */
  uploadForContainer: (attachment: Attachment) => Promise<string>;
};

export async function attachmentBlocks(attachments: Attachment[], loader: AttachmentLoader, opts: { containerUploads: boolean; caps: ModelCaps }): Promise<{ blocks: ContentBlockParam[]; skipped: string[] }> {
  const blocks: ContentBlockParam[] = [];
  const skipped: string[] = [];
  for (const att of attachments) {
    if (att.kind === "image") {
      if (!opts.caps.imageInput) { skipped.push(`${att.name}（このモデルは画像に未対応）`); continue; }
      const data = (await loader.read(att)).toString("base64");
      blocks.push({ type: "image", source: { type: "base64", media_type: att.mediaType as "image/png", data } });
    } else if (att.kind === "pdf") {
      if (!opts.caps.pdfInput) { skipped.push(`${att.name}（このモデルは PDF に未対応）`); continue; }
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
      skipped.push(`${att.name}（「データ分析」か「ファイル作成」をオンにすると読み込めます）`);
    }
  }
  return { blocks, skipped };
}

export async function buildMessages(turns: ChatTurn[], knowledge: Attachment[], loader: AttachmentLoader, opts: { containerUploads: boolean; caps: ModelCaps }): Promise<{ messages: MessageParam[]; skipped: string[] }> {
  const history = selectHistory(turns);
  const skipped: string[] = [];
  const messages: MessageParam[] = [];
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
    if (turn.content) content.push({ type: "text", text: turn.content });
    if (!content.length) content = [{ type: "text", text: "（添付ファイルのみ）" }];
    const last = messages[messages.length - 1];
    if (last && last.role === turn.role) (last.content as ContentBlockParam[]).push(...content);
    else messages.push({ role: turn.role, content });
  }
  return { messages, skipped: [...new Set(skipped)] };
}

export function buildTools(flags: ToolFlags, caps: ModelCaps): { tools: ToolUnion[]; skills: string[]; unavailable: string[] } {
  const tools: ToolUnion[] = [];
  const unavailable: string[] = [];
  if (flags.webSearch) {
    if (caps.webSearch) tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 5 });
    else unavailable.push("Web 検索");
  }
  if (flags.webFetch) {
    if (caps.webSearch) tools.push({ type: "web_fetch_20250910", name: "web_fetch", max_uses: 5 });
    else unavailable.push("URL の読み込み");
  }
  const wantsCode = flags.files || flags.analysis;
  if (wantsCode) {
    if (caps.codeExecution) tools.push({ type: "code_execution_20250825", name: "code_execution" });
    else unavailable.push(flags.files ? "ファイル作成" : "データ分析");
  }
  if (flags.memory) tools.push({ type: "memory_20250818", name: "memory" });
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
  switch (name) {
    case "web_search": return "Web を検索しています…";
    case "web_fetch": return "ページを読み込んでいます…";
    case "code_execution": case "bash_code_execution": case "text_editor_code_execution": return "コードを実行しています…";
    case "memory": return "メモリを確認しています…";
    default: return null;
  }
}

export type ToolStep = {
  kind: "search" | "fetch" | "code" | "file" | "memory" | "other";
  label: string;
  detail?: string;
  output?: string;
  error?: boolean;
  sources?: { url: string; title: string }[];
};
const clip = (value: unknown, max = 4000) => {
  const s = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
  return s.length > max ? s.slice(0, max) + "\n…（以下略）" : s;
};
const TEXT_EDITOR_LABELS: Record<string, string> = { view: "ファイルを表示", create: "ファイルを作成", str_replace: "ファイルを編集", insert: "ファイルに追記" };
const MEMORY_LABELS: Record<string, string> = { view: "メモリを確認", create: "メモリに保存", str_replace: "メモリを更新", insert: "メモリに追記", delete: "メモリを削除", rename: "メモリの名前を変更" };

/**
 * Tool calls made while answering, paired with their results, for the expandable "what Claude did" view.
 * Server tools (web search/fetch, code execution) come back as content blocks; client memory results are passed in.
 */
export function extractSteps(blocks: unknown[], clientResults: Map<string, { content: string; isError?: boolean }> = new Map()): ToolStep[] {
  const results = new Map<string, any>();
  for (const b of blocks as any[]) if (b && typeof b.tool_use_id === "string" && typeof b.type === "string" && b.type.endsWith("_tool_result")) results.set(b.tool_use_id, b);
  const steps: ToolStep[] = [];
  for (const b of blocks as any[]) {
    if (!b || (b.type !== "server_tool_use" && b.type !== "tool_use")) continue;
    const input = b.input ?? {};
    const result = results.get(b.id)?.content;
    const errorCode = result && typeof result === "object" && !Array.isArray(result) && typeof result.error_code === "string" ? result.error_code : undefined;
    if (b.name === "web_search") {
      const list = Array.isArray(result) ? result.filter((r: any) => r?.type === "web_search_result").map((r: any) => ({ url: String(r.url ?? ""), title: String(r.title ?? r.url ?? "") })) : [];
      steps.push({ kind: "search", label: `「${clip(input.query, 200)}」を検索`, ...(errorCode ? { error: true, output: `エラー: ${errorCode}` } : { sources: list.slice(0, 20), output: `${list.length} 件の結果` }) });
    } else if (b.name === "web_fetch") {
      const title = result?.content?.title ?? result?.url ?? input.url;
      steps.push({ kind: "fetch", label: "ページを読み込み", detail: clip(input.url, 500), ...(errorCode ? { error: true, output: `エラー: ${errorCode}` } : { output: clip(title, 300) }) });
    } else if (b.name === "bash_code_execution" || b.name === "code_execution") {
      const out = [result?.stdout ? clip(result.stdout) : "", result?.stderr ? "[stderr]\n" + clip(result.stderr, 2000) : ""].filter(Boolean).join("\n");
      steps.push({ kind: "code", label: "コードを実行", detail: clip(input.command ?? input.code), ...(errorCode ? { error: true, output: `エラー: ${errorCode}` } : { output: out || (typeof result?.return_code === "number" ? `終了コード ${result.return_code}` : ""), ...(result?.return_code ? { error: true } : {}) }) });
    } else if (b.name === "text_editor_code_execution") {
      const command = String(input.command ?? "");
      steps.push({ kind: "file", label: `${TEXT_EDITOR_LABELS[command] ?? "ファイル操作"}: ${clip(input.path, 300)}`, ...(command === "create" && input.file_text ? { detail: clip(input.file_text) } : {}),
        ...(errorCode ? { error: true, output: `エラー: ${errorCode}` } : result?.content && typeof result.content === "string" ? { output: clip(result.content) } : {}) });
    } else if (b.name === "memory") {
      const own = clientResults.get(b.id);
      steps.push({ kind: "memory", label: `${MEMORY_LABELS[String(input.command)] ?? "メモリ操作"}${input.path ? `: ${clip(input.path, 300)}` : ""}`, ...(own ? { output: clip(own.content), ...(own.isError ? { error: true } : {}) } : {}) });
    } else {
      steps.push({ kind: "other", label: String(b.name ?? "ツール"), detail: clip(input, 2000) });
    }
  }
  return steps;
}
