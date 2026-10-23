import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Image as ImageIcon, Pencil, RefreshCw, StepForward, X } from "lucide-react";
import { CopyButton, Markdown, ThinkingBlock, linkCitations } from "./MessageContent";
import { LogoGlyph } from "./LogoMark";
import StepsBlock from "./StepsBlock";
import { stopNotice, type ToolStep } from "../lib/steps";
import { formatUsd } from "../lib/pricing";

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
const KIND_LABEL = { image: "画像", pdf: "PDF", text: "テキスト", file: "ファイル" } as const;

const previewCache = new Map<string, string | null>();

/** Full-size view of an attachment: images and text open in the app, PDFs in the OS viewer. */
function AttachmentViewer({ attachment, image, onClose }: { attachment: Attachment; image: string | null; onClose: () => void }) {
  const [text, setText] = useState<{ text: string; truncated: boolean } | null>(null);
  useEffect(() => {
    if (attachment.kind === "text") window.continuity.attachmentText(attachment.id).then(setText).catch(() => setText({ text: "読み込めませんでした。", truncated: false }));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [attachment.id, attachment.kind, onClose]);
  return <div className="overlay viewer" onMouseDown={onClose}>
    <div className={"viewer-box kind-" + attachment.kind} role="dialog" aria-modal="true" aria-label={attachment.name} onMouseDown={e => e.stopPropagation()}>
      <div className="viewer-head"><b>{attachment.name}</b><small>{KIND_LABEL[attachment.kind]} · {formatBytes(attachment.size)}</small>
        <button className="ghost-btn" onClick={onClose} aria-label="閉じる"><X size={18} /></button></div>
      {attachment.kind === "image" && image && <img src={image} alt={attachment.name} />}
      {attachment.kind === "text" && <pre className="viewer-text">{text ? text.text + (text.truncated ? "\n\n…（長いため以降は省略）" : "") : "読み込み中…"}</pre>}
    </div>
  </div>;
}

export function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
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
  return <span className={"attachment-chip kind-" + attachment.kind + (viewable ? " viewable" : "")} title={viewable ? `${attachment.name}（クリックで表示）` : attachment.name}>
    <button className="chip-open" onClick={open} disabled={!viewable} aria-label={`${attachment.name} を表示`}>
      {thumb ? <img src={thumb} alt="" /> : <span className="attachment-icon">{attachment.kind === "image" ? <ImageIcon size={14} /> : attachment.kind === "pdf" ? "PDF" : <FileText size={14} />}</span>}
      <span className="attachment-text"><b>{attachment.name}</b><small>{KIND_LABEL[attachment.kind]} · {formatBytes(attachment.size)}</small></span>
    </button>
    {onRemove && <button className="chip-remove" onClick={onRemove} aria-label={`${attachment.name} を外す`}>×</button>}
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);
  const alternates = m.alternates?.length ?? 0;
  const altIndex = m.altIndex ?? Math.max(0, alternates - 1);
  const versions = m.versions?.length ?? 0;
  const versionIndex = m.versionIndex ?? Math.max(0, versions - 1);
  if (m.role === "user") {
    return <article className="message user">
      {!!m.attachments?.length && <div className="attachment-row">{m.attachments.map(a => <AttachmentChip key={a.id} attachment={a} />)}</div>}
      {editing
        ? <div className="edit-box">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus aria-label="メッセージを編集"
            onKeyDown={e => { if (e.key === "Escape") { setEditing(false); setDraft(m.content); } }} />
          <div className="edit-actions"><span>送信すると新しい版として回答を作ります。前の版とその回答は「&lt; 1/2 &gt;」で切り替えて見られます。</span>
            <button className="btn-secondary small" onClick={() => { setEditing(false); setDraft(m.content); }}>キャンセル</button>
            <button className="btn-primary small" disabled={!draft.trim() || busy} onClick={() => { setEditing(false); onEdit(draft.trim()); }}>保存して送信</button></div>
        </div>
        : m.content && <div className="user-bubble">{m.content}</div>}
      {!editing && m.content && <div className="msg-actions">
        <CopyButton text={m.content} iconOnly />
        <button className="icon-action tip" data-tip="編集" aria-label="編集" disabled={busy} onClick={() => { setDraft(m.content); setEditing(true); }}><Pencil size={15} /></button>
        {versions > 1 && <span className="alt-switch">
          <button className="icon-action" disabled={busy || versionIndex === 0} onClick={() => onSelectVersion(versionIndex - 1)} aria-label="前の版"><ChevronLeft size={15} /></button>
          {versionIndex + 1} / {versions}
          <button className="icon-action" disabled={busy || versionIndex >= versions - 1} onClick={() => onSelectVersion(versionIndex + 1)} aria-label="次の版"><ChevronRight size={15} /></button>
        </span>}
      </div>}
    </article>;
  }
  const notice = stopNotice(m.stopReason);
  return <article className={"message assistant" + (isLast ? " last" : "")}>
    {(m.thinking || m.thinkingSeconds) && <ThinkingBlock text={m.thinking ?? ""} seconds={m.thinkingSeconds} />}
    {!!m.steps?.length && <StepsBlock steps={m.steps} />}
    <Markdown text={linkCitations(m.content, m.citations)} />
    {m.aborted && <p className="msg-note">応答を途中で停止しました</p>}
    {notice && <div className={"stop-notice" + (m.stopReason === "refusal" ? " refusal" : "")}><span>{notice.text}</span>
      {notice.canContinue && isLast && <button className="btn-secondary small" disabled={busy} onClick={onContinue}><StepForward size={13} />続ける</button>}</div>}
    {!!m.files?.length && <div className="file-cards">{m.files.map(f => {
      const badge = fileBadge(f.name);
      return <div key={f.fileId} className="file-card">
        <span className={"file-badge tone-" + badge.tone}>{badge.label}</span>
        <span className="file-text"><b>{f.name}</b><small>{f.size != null ? formatBytes(f.size) + " · " : ""}Claude が作成</small></span>
        <button className="btn-primary small" onClick={() => onSaveFile(f.fileId, f.name)}><Download size={13} /> 保存</button>
      </div>;
    })}</div>}
    {!!m.citations?.length && <div className="sources"><span>出典</span>{m.citations.map((c, i) =>
      <a key={c.url} href={c.url} target="_blank" rel="noreferrer" className="source"><em>{i + 1}</em><span>{c.title}</span><small>{hostOf(c.url)}</small></a>)}</div>}
    <div className="msg-actions">
      {isLast && <span className="end-mark"><LogoGlyph size={22} /></span>}
      {m.content && <CopyButton text={m.content} iconOnly />}
      {isLast && <button className="icon-action tip" data-tip="再生成" aria-label="再生成" disabled={busy} onClick={onRegenerate}><RefreshCw size={15} /></button>}
      {alternates > 1 && <span className="alt-switch">
        <button className="icon-action" disabled={busy || altIndex === 0} onClick={() => onSelectAlternate(altIndex - 1)} aria-label="前の回答"><ChevronLeft size={15} /></button>
        {altIndex + 1} / {alternates}
        <button className="icon-action" disabled={busy || altIndex >= alternates - 1} onClick={() => onSelectAlternate(altIndex + 1)} aria-label="次の回答"><ChevronRight size={15} /></button>
      </span>}
      {m.model && <span className="msg-meta">{m.model}{m.costUsd != null ? ` · ${formatUsd(m.costUsd, 4)}` : ""}</span>}
    </div>
  </article>;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}
