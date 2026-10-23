import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Image as ImageIcon, Pencil, RefreshCw, StepForward } from "lucide-react";
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
export type Msg = Reply & { role: "user" | "assistant"; attachments?: Attachment[]; alternates?: Reply[]; altIndex?: number };

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}
const KIND_LABEL = { image: "画像", pdf: "PDF", text: "テキスト", file: "ファイル" } as const;

const previewCache = new Map<string, string | null>();
export function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  const [thumb, setThumb] = useState<string | null>(previewCache.get(attachment.id) ?? null);
  useEffect(() => {
    if (attachment.kind !== "image" || previewCache.has(attachment.id)) return;
    let alive = true;
    window.continuity.attachmentPreview(attachment.id).then(url => { previewCache.set(attachment.id, url); if (alive) setThumb(url); }).catch(() => previewCache.set(attachment.id, null));
    return () => { alive = false; };
  }, [attachment.id, attachment.kind]);
  return <span className={"attachment-chip kind-" + attachment.kind} title={attachment.name}>
    {thumb ? <img src={thumb} alt="" /> : <span className="attachment-icon">{attachment.kind === "image" ? <ImageIcon size={14} /> : attachment.kind === "pdf" ? "PDF" : <FileText size={14} />}</span>}
    <span className="attachment-text"><b>{attachment.name}</b><small>{KIND_LABEL[attachment.kind]} · {formatBytes(attachment.size)}</small></span>
    {onRemove && <button className="chip-remove" onClick={onRemove} aria-label={`${attachment.name} を外す`}>×</button>}
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
};

export default function MessageItem({ message: m, isLast, busy, onRegenerate, onEdit, onSelectAlternate, onSaveFile, onContinue }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);
  const alternates = m.alternates?.length ?? 0;
  const altIndex = m.altIndex ?? Math.max(0, alternates - 1);
  if (m.role === "user") {
    return <article className="message user">
      {!!m.attachments?.length && <div className="attachment-row">{m.attachments.map(a => <AttachmentChip key={a.id} attachment={a} />)}</div>}
      {editing
        ? <div className="edit-box">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus aria-label="メッセージを編集"
            onKeyDown={e => { if (e.key === "Escape") { setEditing(false); setDraft(m.content); } }} />
          <div className="edit-actions"><span>保存すると、このメッセージ以降の回答を新しい回答に置き換えます。</span>
            <button className="btn-secondary small" onClick={() => { setEditing(false); setDraft(m.content); }}>キャンセル</button>
            <button className="btn-primary small" disabled={!draft.trim() || busy} onClick={() => { setEditing(false); onEdit(draft.trim()); }}>保存して送信</button></div>
        </div>
        : m.content && <div className="user-bubble">{m.content}</div>}
      {!editing && m.content && <div className="msg-actions">
        <CopyButton text={m.content} iconOnly />
        <button className="icon-action tip" data-tip="編集" aria-label="編集" disabled={busy} onClick={() => { setDraft(m.content); setEditing(true); }}><Pencil size={15} /></button>
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
