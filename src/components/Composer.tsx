import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { ArrowUp, Camera, Plus, Square } from "lucide-react";
import ToolsMenu, { type ConnectorOption, type Tools } from "./ToolsMenu";
import ModelMenu from "./ModelMenu";
import { AttachmentChip } from "./MessageItem";
import { useT } from "../i18n";

// Shared by the send and stop buttons (the hover and press effects apply to both).
const SEND = "ml-[4px] inline-grid size-[32px] place-items-center rounded-[10px] border-0 p-0 shadow-[0_1px_2px_#0004] enabled:hover:bg-accent-hover enabled:active:[transform:scale(.93)]";

type Attachment = { id: string; name: string; mediaType: string; size: number; kind: "image" | "pdf" | "text" | "file" };
type Option = { value: string; label: string };
export type ComposerHandle = { focus: () => void };
type Props = {
  draft: string; onDraft: (text: string) => void;
  attachments: Attachment[]; onRemoveAttachment: (id: string) => void; onPickFiles: () => void; onScreenshot: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onSend: () => void; onStop: () => void; busy: boolean;
  tools: Tools; onTools: (tools: Tools) => void; projectMemory?: boolean;
  style: string; styles: Option[]; onStyle: (v: string) => void;
  model: string; models: Option[]; onModel: (v: string) => void; modelsLoading: boolean; onRefreshModels: () => void;
  effort: string; efforts: Option[]; onEffort: (v: string) => void;
  placeholder: string; placement?: "up" | "down";
  connectors?: ConnectorOption[]; onManageConnectors?: () => void;
  /** Where the composer sits: the new-chat welcome screen or the conversation footer. */
  variant?: "welcome" | "footer"; incognito?: boolean;
};

const Composer = forwardRef<ComposerHandle, Props>(function Composer(p, ref) {
  const t = useT();
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
  const welcome = p.variant === "welcome";
  return <div className={"composer @container w-full rounded-[20px] border bg-surface-2 pt-[14px] pr-[12px] pb-[10px] pl-[16px] "
    + "shadow-[0_1px_2px_#0003,0_8px_28px_#0002] [transition:border-color_.15s_ease,box-shadow_.2s_ease] "
    + "focus-within:border-line-input focus-within:shadow-[0_1px_2px_#0003,0_10px_34px_#0004] "
    + "light:shadow-[0_1px_2px_#0000000d,0_6px_24px_#0000000f] light:focus-within:shadow-[0_1px_2px_#0000000d,0_8px_30px_#00000017] "
    + (p.variant === "footer" ? "max-w-[760px] " : "max-w-[820px] ")
    + (welcome ? "m-0 flex min-h-[120px] flex-col " : "m-auto ")
    + (p.incognito ? "border-dashed border-line-input" : "border-line-strong")}>
    {p.attachments.length > 0 && <div className="attachment-row mt-[6px] mb-[8px] flex flex-wrap gap-[6px]">{p.attachments.map(a => <AttachmentChip key={a.id} attachment={a} onRemove={() => p.onRemoveAttachment(a.id)} />)}</div>}
    <textarea ref={area} rows={1} className={"block h-auto max-h-[300px] w-full resize-none overflow-y-auto border-0 bg-transparent px-[2px] pt-[2px] pb-0 font-sans text-[15px] leading-[1.6] font-normal text-ink outline-none placeholder:text-subtle "
      + (welcome ? "min-h-[48px] flex-auto" : "min-h-[26px]")} value={p.draft} placeholder={p.placeholder} aria-label={t.composer.message}
      onChange={e => p.onDraft(e.target.value)} onPaste={p.onPaste}
      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!p.busy && canSend) p.onSend(); } }} />
    <div className="composer-bar mt-[10px] flex items-center gap-[4px]">
      <button className="round-btn tip" data-tip={t.composer.attachFiles} aria-label={t.composer.attachFiles} onClick={p.onPickFiles} disabled={p.busy}><Plus size={17} /></button>
      <button className="round-btn screenshot tip" data-tip={t.composer.screenshot} aria-label={t.composer.screenshot} onClick={p.onScreenshot} disabled={p.busy}><Camera size={16} /></button>
      <ToolsMenu tools={p.tools} onChange={p.onTools} disabled={p.busy} projectMemory={p.projectMemory}
        style={p.style} styles={p.styles} onStyle={p.onStyle} placement={p.placement} connectors={p.connectors} onManageConnectors={p.onManageConnectors} />
      <span className="spacer flex-1" />
      <ModelMenu model={p.model} models={p.models} onModel={p.onModel} modelsLoading={p.modelsLoading} onRefresh={p.onRefreshModels}
        effort={p.effort} efforts={p.efforts} onEffort={p.onEffort} disabled={p.busy} placement={p.placement} />
      {p.busy
        ? <button className={"send-btn stop tip " + SEND + " bg-ink-2 text-bg animate-[popIn_.18s_var(--ease)]"} data-tip={t.composer.stopTip} aria-label={t.composer.stop} onClick={p.onStop}><Square size={12} fill="currentColor" /></button>
        : <button className={"send-btn tip " + SEND + " bg-accent text-on-accent disabled:bg-send-off disabled:text-send-off-text disabled:shadow-none"} data-tip={t.composer.sendTip} aria-label={t.composer.send} onClick={p.onSend} disabled={!canSend}><ArrowUp size={17} strokeWidth={2.4} /></button>}
    </div>
  </div>;
});
export default Composer;
