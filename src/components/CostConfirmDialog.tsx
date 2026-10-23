import { Frame } from "./Dialog";
import { useT } from "../i18n";

export type CostConfirm = {
  inputTokens: string; inputUsd: string; outputTokens: string; outputUsd: string; worstUsd: string;
  perMessage: { limit: string; over: boolean } | null; today: string; daily: string | null; dailyOver: boolean; canBatch: boolean;
};

const ROW = "flex items-baseline justify-between gap-[16px] py-[3px] text-[12.5px] text-ink-4";
const VALUE = "text-right text-ink-2 tabular-nums";

/** Shown before sending when the estimate would pass a spending limit (Settings → Credit → Spending limits). */
export default function CostConfirmDialog({ info, onCancel, onBatch, onSend }: { info: CostConfirm; onCancel: () => void; onBatch: () => void; onSend: () => void }) {
  const t = useT();
  const c = t.spend.confirm;
  return <Frame title={c.title} onClose={onCancel}>
    <div className="cost-confirm">
      <p className="mx-0 mt-[4px] mb-[12px] text-[12.5px] text-muted">{c.intro}</p>
      <div className={ROW}><span>{c.input}</span><span className={VALUE}>{c.inputValue(info.inputTokens, info.inputUsd)}</span></div>
      <div className={ROW}><span>{c.output(info.outputTokens)}</span><span className={VALUE}>{info.outputUsd}</span></div>
      <div className={ROW}><span>{c.worst}</span><span className={VALUE}>{info.worstUsd}</span></div>
      <div className="my-[8px] border-t border-line" />
      {info.perMessage && <div className={ROW}><span>{c.perMessage}</span><span className={VALUE + (info.perMessage.over ? " font-semibold text-warn" : "")}>{info.perMessage.over ? c.over(info.perMessage.limit) : c.within(info.perMessage.limit)}</span></div>}
      <div className={ROW}><span>{c.today}</span><span className={VALUE + (info.dailyOver ? " font-semibold text-warn" : "")}>{info.daily ? `${info.today} / ${info.daily}` : info.today}</span></div>
      <p className="mx-0 mt-[10px] mb-0 text-[11px] text-subtle">{c.hint}</p>
    </div>
    <div className="actions">
      <button className="btn-secondary" onClick={onCancel}>{c.cancel}</button>
      {info.canBatch && <button className="btn-secondary cost-batch border-accent/60 text-link" onClick={onBatch}>{c.batch}</button>}
      <button className="btn-primary cost-send" autoFocus onClick={onSend}>{c.send}</button>
    </div>
  </Frame>;
}
