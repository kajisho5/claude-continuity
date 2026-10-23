import { Loader2, CircleAlert, CircleSlash, Clock3 } from "lucide-react";
import { formatUsd } from "../lib/pricing";
import { intlLocale, useT } from "../i18n";

type Job = Awaited<ReturnType<typeof window.continuity.listBatches>>[number];
export type BatchState = { id: string; status: "pending" | "done" | "expired" | "canceled" | "errored"; note?: string };

/** In the thread, where a Batch reply will arrive: progress, the estimate, cancel; or why nothing came and a normal resend. */
export default function BatchPendingCard({ state, job, onCancel, onResend, busy }: { state: BatchState; job?: Job; onCancel: () => void; onResend: () => void; busy: boolean }) {
  const t = useT();
  const b = t.spend.batch;
  const time = job?.createdAt ? new Date(job.createdAt).toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit" }) : "";
  if (state.status === "pending") {
    return <div className="batch-pending my-[4px] flex items-center gap-[14px] rounded-[12px] border border-accent/60 bg-accent/8 px-[16px] py-[12px]">
      <Loader2 size={18} className="shrink-0 animate-spin text-link" />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <b className="flex flex-wrap items-center gap-[8px] text-[13px] text-ink-2">{b.pendingTitle}
          {job?.estimateUsd != null && <span className="rounded-[9px] bg-accent/20 px-[8px] py-[1px] text-[10.5px] font-semibold text-link">{b.estimate(formatUsd(job.estimateUsd, 2))}</span>}</b>
        <span className="text-[11.5px] text-muted">{job?.canceling ? b.canceling : b.pendingNote}</span>
        {time && <small className="text-[10.5px] text-subtle">{b.sentAt(time)}</small>}
      </div>
      {!job?.canceling && <button className="btn-secondary small batch-cancel" onClick={onCancel}>{b.cancel}</button>}
    </div>;
  }
  const Icon = state.status === "canceled" ? CircleSlash : state.status === "expired" ? Clock3 : CircleAlert;
  const label = state.status === "expired" ? b.expired : state.status === "canceled" ? b.canceled : b.errored;
  return <div className={"batch-ended my-[4px] flex items-center gap-[12px] rounded-[12px] border border-line-strong bg-surface px-[16px] py-[11px] text-[12.5px] text-ink-4 status-" + state.status}>
    <Icon size={16} className="shrink-0 text-muted" />
    <span className="min-w-0 flex-1">{label}{state.note && state.status === "errored" ? `: ${state.note}` : ""}</span>
    <button className="btn-secondary small batch-resend" disabled={busy} onClick={onResend}>{b.resend}</button>
  </div>;
}
