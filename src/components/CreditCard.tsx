import { PLAN_LABELS, formatShortDate, type CreditSummary } from "../lib/credit";
import { formatUsd } from "../lib/pricing";
import { intlLocale, useT } from "../i18n";

type Totals = { inputTokens: number; outputTokens: number; calls: number; mcpCalls?: number };
type Props = { summary: CreditSummary | null; totals: Totals; onConfigure: () => void };

const CARD = "credit-card relative m-[10px_0_0] flex shrink-0 flex-col gap-[5px] rounded-[10px] border border-line bg-surface p-[12px]";
const HEAD = "credit-head flex items-center justify-between text-[9px] text-muted";
const CHIP = "plan-chip rounded-[8px] border border-line-strong bg-line px-[7px] py-[2px] text-[8px] text-ink-4 not-italic";
const FIGURE = "credit-figure mt-[4px] font-serif text-[22px] font-semibold tracking-[-.4px]";
const NOTE = "m-0 text-[9px] leading-[1.6] text-muted";
const LINE = "credit-line m-[2px_0_0] text-[9px]";
const FOOTER = "mt-[6px] flex flex-col gap-[3px] border-t border-line pt-[7px] text-[8px] text-subtle [&_span:last-child]:text-faint";
/** Pace colors for the bar fill, the "today" marker and the chip (under = warn, on = ok, over = danger). */
const PACE = {
  under: { fill: "bg-accent", marker: "bg-warn", chip: "bg-warn/14 text-warn" },
  on: { fill: "bg-accent", marker: "bg-ok", chip: "bg-ok/14 text-ok" },
  over: { fill: "bg-danger", marker: "bg-danger", chip: "bg-danger/14 text-danger" }
} as const;

function compactTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString(intlLocale());
}

export default function CreditCard({ summary, totals, onConfigure }: Props) {
  const t = useT();
  const c = t.credit.card;
  const device = c.device(totals.calls, totals.mcpCalls, compactTokens(totals.inputTokens + totals.outputTokens));
  if (!summary) {
    return <section className={CARD}>
      <div className={HEAD}><span>{c.thisMonth}</span></div>
      <strong className={FIGURE + " text-ink"}>{c.notSet}</strong>
      <p className={"credit-note " + NOTE}>{c.setupNote}</p>
      <button className="btn-primary credit-setup mt-[6px]" onClick={onConfigure}>{c.setup}</button>
      <footer className={FOOTER}><span>{device}</span><span>{c.checkConsole}</span></footer>
    </section>;
  }
  if (summary.plan === "none") {
    return <section className={CARD}>
      <div className={HEAD}><span>{c.estimatedSpend}</span><em className={CHIP}>{PLAN_LABELS.none}</em></div>
      <strong className={FIGURE + " text-ink"}>{formatUsd(summary.spentUsd)}</strong>
      <p className={"credit-note " + NOTE}>{t.credit.range(formatShortDate(summary.cycleStart), formatShortDate(summary.cycleEnd))}{c.noGrant}</p>
      <footer className={FOOTER}><span>{device}</span>{summary.unpricedCalls > 0 && <span>{c.unpricedExcluded(summary.unpricedCalls)}</span>}</footer>
    </section>;
  }
  const negative = summary.remainingUsd < 0;
  const used = Math.min(1, Math.max(0, summary.usedRatio));
  const pace = PACE[summary.pace];
  return <section className={`${CARD} pace-${summary.pace}`}>
    <div className={HEAD}><span>{c.thisMonth}</span><em className={CHIP}>{PLAN_LABELS[summary.plan]}</em></div>
    <strong className={FIGURE + (negative ? " negative text-danger" : " text-ink")}>{formatUsd(summary.remainingUsd)}<small className="ml-[4px] font-sans text-[10px] font-normal text-muted">{c.remaining}</small></strong>
    <p className={"credit-sub " + NOTE}>{c.sub(formatUsd(summary.monthlyAmountUsd), formatUsd(summary.spentUsd))}</p>
    <div className="credit-bar relative mt-[6px] h-[6px] rounded-[3px] bg-line" role="img" aria-label={c.barLabel(Math.round(used * 100), Math.round(summary.elapsedRatio * 100))}>
      <span className={"credit-fill absolute top-0 bottom-0 left-0 rounded-[3px] " + pace.fill} style={{ width: `${used * 100}%` }} />
      <span className={"credit-marker absolute top-[-5px] ml-[-1px] h-[16px] w-[2px] rounded-[1px] " + pace.marker} style={{ left: `${summary.elapsedRatio * 100}%` }} />
    </div>
    <span className="credit-marker-label relative my-[2px] translate-x-[-50%] self-start text-[7px] whitespace-nowrap text-subtle" style={{ left: `${Math.min(80, Math.max(20, summary.elapsedRatio * 100))}%` }}>{c.todayMarker}</span>
    <span className={"pace-chip inline-flex items-center gap-[6px] self-start rounded-[10px] px-[9px] py-[3px] text-[9px] font-semibold " + pace.chip}><i className="size-[6px] rounded-full bg-current" />{c.pace[summary.pace]}</span>
    <p className={LINE + " text-ink-4"}>{c.expires(summary.daysLeft, formatShortDate(summary.cycleEnd))}</p>
    {negative
      ? <p className={LINE + " strong text-ink-3"}>{c.overGrant}</p>
      : summary.pace === "over"
        ? <p className={LINE + " strong text-ink-3"}>{c.stayWithinBefore}<b className="text-ink">{formatUsd(summary.dailyBudgetUsd)}</b>{c.stayWithinAfter}</p>
        : <p className={LINE + " strong text-ink-3"}>{c.useUpBefore}<b className="text-ink">{formatUsd(summary.dailyBudgetUsd)}</b>{c.useUpAfter}</p>}
    <footer className={FOOTER}>
      <span>{device}{summary.unpricedCalls > 0 ? c.unpriced(summary.unpricedCalls) : ""}</span>
      <span>{summary.calibrated && summary.calibratedAt
        ? c.calibrated(formatShortDate(summary.calibratedAt), summary.calibratedAt.toTimeString().slice(0, 5))
        : c.estimate}</span>
    </footer>
  </section>;
}
