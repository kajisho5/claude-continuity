import { Timer } from "lucide-react";
import { PAGE, PAGE_HEAD, PAGE_TITLE } from "./ChatsPage";
import { EMPTY, EMPTY_TEXT } from "./ProjectsPage";
import { formatUsd } from "../lib/pricing";
import { relativeTime } from "../lib/time";
import { useT } from "../i18n";

type Job = Awaited<ReturnType<typeof window.continuity.listBatches>>[number];
const CHIP: Record<Job["status"], string> = {
  pending: "bg-accent/18 text-link", done: "bg-ok/14 text-ok", expired: "bg-line text-muted", canceled: "bg-line text-muted", errored: "bg-danger/14 text-danger"
};

/** Every reply sent with Batch: still processing, arrived, or ended without a reply. */
export default function BatchJobsPage({ jobs, models, now, onOpen, onCancel, onClear }: { jobs: Job[]; models: Record<string, string>; now: number; onOpen: (chatId: string) => void; onCancel: (id: string) => void; onClear: () => void }) {
  const t = useT();
  const b = t.spend.batch;
  const sorted = [...jobs].sort((a, c) => c.createdAt.localeCompare(a.createdAt));
  const label = (j: Job) => j.status === "pending" ? b.status.pending(Math.max(0, Math.floor((now - Date.parse(j.createdAt)) / 60_000))) : b.status[j.status];
  const cost = (j: Job) => j.costUsd != null ? b.costHalf(formatUsd(j.costUsd, 2)) : j.estimateUsd != null ? b.estimate(formatUsd(j.estimateUsd, 2)) : "";
  return <section className={PAGE + " batch-page"}>
    <div className={PAGE_HEAD}><h1 className={PAGE_TITLE}>{b.pageTitle}</h1>
      {jobs.some(j => j.status !== "pending") && <button className="btn-secondary small batch-clear" onClick={onClear}>{b.clear}</button>}</div>
    <p className="mt-[8px] mb-[18px] text-[13px] text-muted">{b.pageIntro}</p>
    {sorted.length === 0
      ? <div className={EMPTY}><Timer size={28} /><p className={EMPTY_TEXT}>{b.empty}</p></div>
      : <ul className="batch-list m-0 flex list-none flex-col gap-[8px] p-0">
        {sorted.map(j => <li key={j.id} className={"batch-row flex items-center gap-[12px] rounded-[12px] border px-[16px] py-[12px] " + (j.status === "pending" ? "border-accent/60 bg-surface" : "border-line bg-surface")}>
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <b className="truncate text-[13.5px] font-semibold text-ink-2">{j.chatTitle || j.id}</b>
            <small className="text-[11.5px] text-muted">{b.meta(models[j.model] ?? j.model, cost(j), relativeTime(j.createdAt, now))}</small>
            {j.status === "expired" && <small className="text-[11px] text-subtle">{j.error || b.expired}</small>}
            {j.status === "errored" && j.error && <small className="text-[11px] text-danger">{j.error}</small>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-[6px]">
            <span className={"batch-status rounded-[10px] px-[10px] py-[2px] text-[10.5px] font-semibold " + CHIP[j.status]}>{j.canceling ? b.canceling : label(j)}</span>
            {j.status === "pending" && !j.canceling
              ? <button className="btn-text px-[4px] py-[2px] text-[11.5px]" onClick={() => onCancel(j.id)}>{b.cancel}</button>
              : <button className="btn-text px-[4px] py-[2px] text-[11.5px] text-link" onClick={() => onOpen(j.chatId)}>{b.open}</button>}
          </div>
        </li>)}
      </ul>}
  </section>;
}
