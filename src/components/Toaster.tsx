import { CircleAlert, CircleCheck, X } from "lucide-react";

export type Toast = { id: number; text: string; kind: "ok" | "error" };

// Legacy `.toast.ok svg:first-child` also matched the close icon (first child of its button), so it is tinted too.
const tone = (t: Toast) => t.kind === "error" ? "text-danger" : "text-ok";

/** Transient notices in the bottom-right corner. */
export default function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return <div className="toaster pointer-events-none fixed top-[60px] right-[20px] z-[60] flex flex-col gap-[8px]" role="status" aria-live="polite">
    {toasts.map(t => <div key={t.id} className={"toast " + t.kind + " pointer-events-auto flex min-w-[240px] max-w-[380px] animate-toast-in items-center gap-[10px] rounded-[12px] border border-line-strong bg-modal py-[10px] pr-[10px] pl-[14px] text-[13px] text-ink-2 shadow-[0_8px_24px_var(--shadow)]"}>
      {t.kind === "error" ? <CircleAlert size={16} className={tone(t)} /> : <CircleCheck size={16} className={tone(t)} />}
      <span className="flex-1">{t.text}</span>
      <button className="toast-x grid size-[24px] place-items-center rounded-[6px] border-0 bg-transparent text-muted hover:bg-line" onClick={() => onDismiss(t.id)} aria-label="閉じる"><X size={14} className={tone(t)} /></button>
    </div>)}
  </div>;
}
