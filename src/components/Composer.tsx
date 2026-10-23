import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { ArrowUp, Plus, Square } from "lucide-react";
import ToolsMenu, { type Tools } from "./ToolsMenu";
import ModelMenu from "./ModelMenu";
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
  placeholder: string; placement?: "up" | "down";
};

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
      <ToolsMenu tools={p.tools} onChange={p.onTools} disabled={p.busy} projectMemory={p.projectMemory}
        style={p.style} styles={p.styles} onStyle={p.onStyle} placement={p.placement} />
      <span className="spacer" />
      <ModelMenu model={p.model} models={p.models} onModel={p.onModel} modelsLoading={p.modelsLoading} onRefresh={p.onRefreshModels}
        effort={p.effort} efforts={p.efforts} onEffort={p.onEffort} disabled={p.busy} placement={p.placement} />
      {p.busy
        ? <button className="send-btn stop tip" data-tip="停止（Esc）" aria-label="停止" onClick={p.onStop}><Square size={12} fill="currentColor" /></button>
        : <button className="send-btn tip" data-tip="送信（Enter）" aria-label="送信" onClick={p.onSend} disabled={!canSend}><ArrowUp size={17} strokeWidth={2.4} /></button>}
    </div>
  </div>;
});
export default Composer;
