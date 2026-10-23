import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Image as ImageIcon, Pencil, RefreshCw, StepForward, X } from "lucide-react";
import { CopyButton, Markdown, ThinkingBlock, linkCitations } from "./MessageContent";
import { LogoGlyph } from "./LogoMark";
import StepsBlock from "./StepsBlock";
import { stopNotice, type ToolStep } from "../lib/steps";
import { formatUsd } from "../lib/pricing";
import { useT } from "../i18n";

type Attachment = { id: string; name: string; mediaType: string; size: number; kind: "image" | "pdf" | "text" | "file" };
type Reply = {
  content: string; thinking?: string; thinkingSeconds?: number; model?: string; costUsd?: number; aborted?: boolean;
  citations?: { url: string; title: string }[]; files?: { fileId: string; name: string; size?: number }[];
  steps?: ToolStep[]; stopReason?: string;
};
export type MsgVersion = { content: string; attachments?: Attachment[]; tail: Msg[] };
export type Msg = Reply & { role: "user" | "assistant"; attachments?: Attachment[]; alternates?: Reply[]; altIndex?: number; versions?: MsgVersion[]; versionIndex?: number };

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

const previewCache = new Map<string, string | null>();

/** Full-size view of an attachment: images and text open in the app, PDFs in the OS viewer. */
function AttachmentViewer({ attachment, image, onClose }: { attachment: Attachment; image: string | null; onClose: () => void }) {
  const t = useT();
  const [text, setText] = useState<{ text: string; truncated: boolean } | null>(null);
  // onClose is a new function on every parent render (each streamed token); keep it in a ref so the file is
  // read once and the listener is not re-added per render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (attachment.kind === "text") window.continuity.attachmentText(attachment.id).then(setText).catch(() => setText({ text: t.message.couldNotLoad, truncated: false }));
  }, [attachment.id, attachment.kind]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.isComposing && e.keyCode !== 229) { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  return <div className="overlay viewer z-50 bg-[#000c] light:bg-[#2a26201f]" onMouseDown={onClose}>
    <div className={"viewer-box kind-" + attachment.kind + " flex max-h-[92vh] max-w-[min(1100px,94vw)] animate-[popIn_.18s_var(--ease)_both] flex-col overflow-hidden rounded-[14px] border border-line-strong bg-modal" + (attachment.kind === "text" ? " w-[min(900px,94vw)]" : "")} role="dialog" aria-modal="true" aria-label={attachment.name} onMouseDown={e => e.stopPropagation()}>
      <div className="viewer-head flex items-center gap-[10px] border-b border-line py-[10px] pr-[10px] pl-[16px]"><b className="truncate text-[13px] text-ink">{attachment.name}</b><small className="flex-1 text-[11px] whitespace-nowrap text-subtle">{t.message.attachmentKind[attachment.kind]} · {formatBytes(attachment.size)}</small>
        <button className="ghost-btn" onClick={onClose} aria-label={t.common.close}><X size={18} /></button></div>
      {attachment.kind === "image" && image && <img className="m-auto block max-h-[calc(92vh-52px)] max-w-full bg-[image:repeating-conic-gradient(#0000_0_25%,#8881_0_50%)] bg-size-[16px_16px] object-contain" src={image} alt={attachment.name} />}
      {attachment.kind === "text" && <pre className="viewer-text m-0 overflow-auto px-[16px] py-[14px] font-mono text-[12.5px] leading-[1.7] [word-break:break-word] whitespace-pre-wrap text-ink-3">{text ? text.text + (text.truncated ? t.message.truncatedLong : "") : t.common.loading}</pre>}
    </div>
  </div>;
}

export function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  const t = useT();
  const [thumb, setThumb] = useState<string | null>(previewCache.get(attachment.id) ?? null);
  const [viewing, setViewing] = useState(false);
  useEffect(() => {
    if (attachment.kind !== "image" || previewCache.has(attachment.id)) return;
    let alive = true;
    window.continuity.attachmentPreview(attachment.id).then(url => { previewCache.set(attachment.id, url); if (alive) setThumb(url); }).catch(() => previewCache.set(attachment.id, null));
    return () => { alive = false; };
  }, [attachment.id, attachment.kind]);
  const viewable = attachment.kind === "image" || attachment.kind === "text" || attachment.kind === "pdf";
  const open = () => {
    if (attachment.kind === "pdf") void window.continuity.openAttachmentPdf(attachment.id, attachment.name).catch(() => {});
    else if (viewable) setViewing(true);
  };
  return <span className={"attachment-chip kind-" + attachment.kind + (viewable ? " viewable hover:border-line-input" : "") + " inline-flex max-w-[260px] animate-[popIn_.18s_var(--ease)_both] items-center gap-[8px] rounded-[9px] border border-line bg-surface py-[5px] pr-[8px] pl-[5px]"} title={viewable ? t.message.clickToView(attachment.name) : attachment.name}>
    <button className="chip-open flex min-w-0 items-center gap-[8px] border-0 bg-transparent p-0 text-left text-inherit disabled:cursor-default! disabled:opacity-100!" onClick={open} disabled={!viewable} aria-label={t.message.view(attachment.name)}>
      {thumb ? <img className="size-[34px] rounded-[6px] object-cover" src={thumb} alt="" /> : <span className={"attachment-icon grid h-[34px] w-[30px] place-items-center rounded-[5px] text-[8px] font-extrabold " + (attachment.kind === "pdf" ? "bg-danger text-[#1D1C1A]" : "bg-raised text-ink-3")}>{attachment.kind === "image" ? <ImageIcon size={14} /> : attachment.kind === "pdf" ? "PDF" : <FileText size={14} />}</span>}
      <span className="attachment-text flex min-w-0 flex-col"><b className="truncate text-[11px] font-medium text-ink-2">{attachment.name}</b><small className="text-[9px] text-muted">{t.message.attachmentKind[attachment.kind]} · {formatBytes(attachment.size)}</small></span>
    </button>
    {onRemove && <button className="chip-remove border-0 bg-transparent px-[2px] py-0 text-[14px] text-muted" onClick={onRemove} aria-label={t.message.remove(attachment.name)}>×</button>}
    {viewing && <AttachmentViewer attachment={attachment} image={thumb} onClose={() => setViewing(false)} />}
  </span>;
}

function fileBadge(name: string): { label: string; tone: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "xls", "csv"].includes(ext)) return { label: "XLS", tone: "green" };
  if (["docx", "doc"].includes(ext)) return { label: "DOC", tone: "blue" };
  if (["pptx", "ppt"].includes(ext)) return { label: "PPT", tone: "orange" };
  if (ext === "pdf") return { label: "PDF", tone: "red" };
  return { label: ext.slice(0, 4).toUpperCase() || "FILE", tone: "gray" };
}

const TONE_BG: Record<string, string> = { green: "bg-ok", blue: "bg-accent", orange: "bg-warn", red: "bg-danger", gray: "bg-muted" };

/** `.message` (+ `.user` / `.assistant`): App.tsx's pending reply article uses ASSISTANT_ARTICLE and ASSISTANT_MARKDOWN too. */
const MESSAGE = "group/msg text-[13px] leading-[1.85] animate-fade-up";
export const USER_ARTICLE = "message user " + MESSAGE + " mb-[14px] flex flex-col items-end gap-[14px]";
export const ASSISTANT_ARTICLE = "message assistant " + MESSAGE + " mb-[22px] block";
/** `.message.assistant .markdown` and the rules after it. */
export const ASSISTANT_MARKDOWN = "mt-0 font-chat text-[16px] leading-[1.78] text-ink-3 [&_h1]:text-ink [&_h2]:text-ink [&_h3]:text-ink [&_code]:font-mono [&_pre]:font-mono [&_table]:font-sans";
/** `.msg-actions`: hidden until the message is hovered or the row has focus; callers add margin-top and opacity. */
const MSG_ACTIONS = "msg-actions flex items-center gap-[2px] transition-opacity duration-200 ease-[ease] group-hover/msg:opacity-100 focus-within:opacity-100";
const ALT_SWITCH = "alt-switch mx-[2px] inline-flex items-center gap-0 text-[10px] text-muted tabular-nums";

type Props = {
  message: Msg;
  isLast: boolean;
  busy: boolean;
  onRegenerate: () => void;
  onEdit: (text: string) => void;
  onSelectAlternate: (index: number) => void;
  onSaveFile: (fileId: string, name: string) => void;
  onContinue: () => void;
  onSelectVersion: (index: number) => void;
};

export default function MessageItem({ message: m, isLast, busy, onRegenerate, onEdit, onSelectAlternate, onSaveFile, onContinue, onSelectVersion }: Props) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);
  const alternates = m.alternates?.length ?? 0;
  const altIndex = m.altIndex ?? Math.max(0, alternates - 1);
  const versions = m.versions?.length ?? 0;
  const versionIndex = m.versionIndex ?? Math.max(0, versions - 1);
  if (m.role === "user") {
    return <article className={USER_ARTICLE}>
      {!!m.attachments?.length && <div className="attachment-row mt-[6px] mb-[8px] flex flex-wrap justify-end gap-[6px]">{m.attachments.map(a => <AttachmentChip key={a.id} attachment={a} />)}</div>}
      {editing
        ? <div className="edit-box mt-[8px] w-full rounded-[10px] border-[1.5px] border-accent bg-surface-2 p-[10px]">
          <textarea className="min-h-[70px] w-full resize-y border-0 bg-transparent font-sans text-[13px] leading-[1.7] text-ink outline-0 focus-visible:outline-none" value={draft} onChange={e => setDraft(e.target.value)} autoFocus aria-label={t.message.editMessage}
            onKeyDown={e => { if (e.key === "Escape" && !e.nativeEvent.isComposing && e.keyCode !== 229) { setEditing(false); setDraft(m.content); } }} />
          <div className="edit-actions flex items-center justify-end gap-[8px]"><span className="flex-1 text-[9.5px] text-muted">{t.message.editHint}</span>
            <button className="btn-secondary small" onClick={() => { setEditing(false); setDraft(m.content); }}>{t.common.cancel}</button>
            <button className="btn-primary small" disabled={!draft.trim() || busy} onClick={() => { setEditing(false); onEdit(draft.trim()); }}>{t.message.saveAndSend}</button></div>
        </div>
        : m.content && <div className="user-bubble max-w-[88%] rounded-[18px] border border-line bg-raised px-[16px] py-[10px] text-[14.5px] leading-[1.7] [overflow-wrap:anywhere] whitespace-pre-wrap text-ink light:border-transparent">{m.content}</div>}
      {!editing && m.content && <div className={MSG_ACTIONS + " mt-[2px] opacity-0"}>
        <CopyButton text={m.content} iconOnly />
        <button className="icon-action tip" data-tip={t.common.edit} aria-label={t.common.edit} disabled={busy} onClick={() => { setDraft(m.content); setEditing(true); }}><Pencil size={15} /></button>
        {versions > 1 && <span className={ALT_SWITCH}>
          <button className="icon-action" disabled={busy || versionIndex === 0} onClick={() => onSelectVersion(versionIndex - 1)} aria-label={t.message.prevVersion}><ChevronLeft size={15} /></button>
          {versionIndex + 1} / {versions}
          <button className="icon-action" disabled={busy || versionIndex >= versions - 1} onClick={() => onSelectVersion(versionIndex + 1)} aria-label={t.message.nextVersion}><ChevronRight size={15} /></button>
        </span>}
      </div>}
    </article>;
  }
  const notice = stopNotice(m.stopReason);
  return <article className={ASSISTANT_ARTICLE + (isLast ? " last" : "")}>
    {(m.thinking || m.thinkingSeconds) && <ThinkingBlock text={m.thinking ?? ""} seconds={m.thinkingSeconds} />}
    {!!m.steps?.length && <StepsBlock steps={m.steps} />}
    <Markdown text={linkCitations(m.content, m.citations)} className={ASSISTANT_MARKDOWN} />
    {m.aborted && <p className="msg-note mt-[6px] mx-0 mb-0 text-[10px] text-warn">{t.message.stoppedPartway}</p>}
    {notice && <div className={"stop-notice mt-[10px] mx-0 mb-0 flex items-center gap-[12px] rounded-[10px] border py-[9px] pr-[10px] pl-[14px] font-sans text-[12.5px] leading-[1.6] text-ink-3 " + (m.stopReason === "refusal" ? "refusal border-danger/45 bg-danger/8" : "border-warn/45 bg-warn/9")}><span className="flex-1">{notice.text}</span>
      {notice.canContinue && isLast && <button className="btn-secondary small" disabled={busy} onClick={onContinue}><StepForward size={13} />{t.message.continue}</button>}</div>}
    {!!m.files?.length && <div className="file-cards mt-[12px] mx-0 mb-[4px] flex flex-col gap-[8px]">{m.files.map(f => {
      const badge = fileBadge(f.name);
      return <div key={f.fileId} className="file-card flex max-w-[380px] items-center gap-[10px] rounded-[10px] border border-line-strong bg-surface px-[12px] py-[10px] transition-[border-color,transform] duration-150 ease-[ease] hover:border-line-input hover:[transform:translateY(-1px)]">
        <span className={"file-badge tone-" + badge.tone + " grid size-[32px] place-items-center rounded-[6px] text-[8px] font-extrabold text-[#141412] " + TONE_BG[badge.tone]}>{badge.label}</span>
        <span className="file-text flex min-w-0 flex-1 flex-col"><b className="truncate text-[12px] text-ink-2">{f.name}</b><small className="text-[9px] text-muted">{f.size != null ? formatBytes(f.size) + " · " : ""}{t.message.createdByClaude}</small></span>
        <button className="btn-primary small" onClick={() => onSaveFile(f.fileId, f.name)}><Download size={13} /> {t.common.save}</button>
      </div>;
    })}</div>}
    {!!m.citations?.length && <div className="sources mt-[12px] flex max-w-[520px] flex-col gap-[5px]"><span className="text-[10px] font-semibold text-muted">{t.message.sources}</span>{m.citations.map((c, i) =>
      <a key={c.url} href={c.url} target="_blank" rel="noreferrer" className="source flex items-center gap-[8px] rounded-[7px] border border-line bg-surface px-[10px] py-[5px] text-[10.5px] text-ink-3 no-underline hover:border-line-input"><em className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-[5px] bg-accent/20 text-[9.5px] font-bold text-link not-italic">{i + 1}</em><span className="min-w-0 flex-1 truncate">{c.title}</span><small className="text-[9px] text-subtle">{hostOf(c.url)}</small></a>)}</div>}
    <div className={MSG_ACTIONS + " mt-[8px] " + (isLast ? "opacity-100" : "opacity-0")}>
      {isLast && <span className="end-mark mr-[4px] inline-grid size-[30px] place-items-center"><LogoGlyph size={22} /></span>}
      {m.content && <CopyButton text={m.content} iconOnly />}
      {isLast && <button className="icon-action tip" data-tip={t.message.regenerate} aria-label={t.message.regenerate} disabled={busy} onClick={onRegenerate}><RefreshCw size={15} /></button>}
      {alternates > 1 && <span className={ALT_SWITCH}>
        <button className="icon-action" disabled={busy || altIndex === 0} onClick={() => onSelectAlternate(altIndex - 1)} aria-label={t.message.prevAnswer}><ChevronLeft size={15} /></button>
        {altIndex + 1} / {alternates}
        <button className="icon-action" disabled={busy || altIndex >= alternates - 1} onClick={() => onSelectAlternate(altIndex + 1)} aria-label={t.message.nextAnswer}><ChevronRight size={15} /></button>
      </span>}
      {m.model && <span className="msg-meta ml-[8px] text-[10.5px] font-normal text-subtle opacity-0 transition-opacity duration-200 ease-[ease] group-hover/msg:opacity-100">{m.model}{m.costUsd != null ? ` · ${formatUsd(m.costUsd, 4)}` : ""}</span>}
    </div>
  </article>;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}
