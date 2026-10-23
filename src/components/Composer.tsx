import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { ArrowUp, Plus, RefreshCw, Square } from "lucide-react";
import ToolsMenu, { type Tools } from "./ToolsMenu";
import { AttachmentChip } from "./MessageItem";

type Attachment = { id: string; name: string; mediaType: string; size: number; kind: "image" | "pdf" | "text" | "file" };
type Option = { value: string; label: string };
export type ComposerHandle = { focus: () => void };
type Props = {
  draft: string; onDraft: (text: string) => void;
  attachments: Attachment[]; onRemoveAttachment: (id: string) => void; onPickFiles: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onSend: () => void; onStop: () => void; busy: boolean;
  tools: Tools; onTools: (tools: Tools) => void; projectMemory?: boolean;
  style: string; styles: Option[]; onStyle: (v: string) => void;
  model: string; models: Option[]; onModel: (v: string) => void; modelsLoading: boolean; onRefreshModels: () => void;
  effort: string; efforts: Option[]; onEffort: (v: string) => void;
  placeholder: string;
};

/** Native <select> styled as a borderless pill, so keyboard and screen readers keep working. */
function Pill({ label, value, options, onChange, disabled, title }: { label: string; value: string; options: Option[]; onChange: (v: string) => void; disabled?: boolean; title?: string }) {
  return <label className="pill tip" data-tip={title ?? label}>
    <span className="sr-only">{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} aria-label={label}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>;
}

const Composer = forwardRef<ComposerHandle, Props>(function Composer(p, ref) {
  const area = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => area.current?.focus() }), []);
  // Grow with the text up to ~12 lines, like the Claude apps.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, [p.draft]);
  const canSend = !!p.draft.trim() || p.attachments.length > 0;
  return <div className="composer">
    {p.attachments.length > 0 && <div className="attachment-row">{p.attachments.map(a => <AttachmentChip key={a.id} attachment={a} onRemove={() => p.onRemoveAttachment(a.id)} />)}</div>}
    <textarea ref={area} rows={1} value={p.draft} placeholder={p.placeholder} aria-label="メッセージ"
      onChange={e => p.onDraft(e.target.value)} onPaste={p.onPaste}
      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!p.busy && canSend) p.onSend(); } }} />
    <div className="composer-bar">
      <button className="round-btn tip" data-tip="ファイルを添付" aria-label="ファイルを添付" onClick={p.onPickFiles} disabled={p.busy}><Plus size={17} /></button>
      <ToolsMenu tools={p.tools} onChange={p.onTools} disabled={p.busy} projectMemory={p.projectMemory} />
      <span className="spacer" />
      <Pill label="スタイル" value={p.style} options={p.styles} onChange={p.onStyle} disabled={p.busy} />
      <Pill label="モデル" value={p.model} options={p.models} onChange={p.onModel} disabled={p.busy || p.modelsLoading} />
      {p.efforts.length > 1 && <Pill label="思考の深さ" title="思考の深さ：深いほど回答の質が上がり、クレジットを多く使います" value={p.effort} options={p.efforts} onChange={p.onEffort} disabled={p.busy} />}
      <button className="ghost-btn tip" data-tip="モデル一覧を更新" aria-label="モデル一覧を更新" onClick={p.onRefreshModels} disabled={p.busy || p.modelsLoading}><RefreshCw size={13} className={p.modelsLoading ? "spin" : ""} /></button>
      {p.busy
        ? <button className="send-btn stop tip" data-tip="停止（Esc）" aria-label="停止" onClick={p.onStop}><Square size={12} fill="currentColor" /></button>
        : <button className="send-btn tip" data-tip="送信（Enter）" aria-label="送信" onClick={p.onSend} disabled={!canSend}><ArrowUp size={17} strokeWidth={2.4} /></button>}
    </div>
  </div>;
});
export default Composer;
