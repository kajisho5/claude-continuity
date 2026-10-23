import { CircleAlert, CircleCheck, X } from "lucide-react";

export type Toast = { id: number; text: string; kind: "ok" | "error" };

/** Transient notices in the bottom-right corner. */
export default function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return <div className="toaster" role="status" aria-live="polite">
    {toasts.map(t => <div key={t.id} className={"toast " + t.kind}>
      {t.kind === "error" ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
      <span>{t.text}</span>
      <button className="toast-x" onClick={() => onDismiss(t.id)} aria-label="閉じる"><X size={14} /></button>
    </div>)}
  </div>;
}
