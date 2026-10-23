import { PLAN_LABELS, formatShortDate, type CreditSummary } from "../lib/credit";
import { formatUsd } from "../lib/pricing";

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

const PACE_LABEL = { under: "余りそうなペース", on: "順調なペース", over: "使いすぎペース" } as const;

function compactTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString();
}

export default function CreditCard({ summary, totals, onConfigure }: Props) {
  const device = `この端末 ${totals.calls}回${totals.mcpCalls ? `（うち MCP ${totals.mcpCalls}回）` : ""} · ${compactTokens(totals.inputTokens + totals.outputTokens)} tokens`;
  if (!summary) {
    return <section className={CARD}>
      <div className={HEAD}><span>今月のAPIクレジット</span></div>
      <strong className={FIGURE + " text-ink"}>未設定</strong>
      <p className={"credit-note " + NOTE}>月間付与額と付与日を設定すると、失効までの残額と消化ペースを表示します。</p>
      <button className="btn-primary credit-setup mt-[6px]" onClick={onConfigure}>クレジットを設定</button>
      <footer className={FOOTER}><span>{device}</span><span>正確な残高は Console の Billing で確認</span></footer>
    </section>;
  }
  if (summary.plan === "none") {
    return <section className={CARD}>
      <div className={HEAD}><span>今月の推定利用額</span><em className={CHIP}>{PLAN_LABELS.none}</em></div>
      <strong className={FIGURE + " text-ink"}>{formatUsd(summary.spentUsd)}</strong>
      <p className={"credit-note " + NOTE}>{formatShortDate(summary.cycleStart)} 〜 {formatShortDate(summary.cycleEnd)} · APIクレジットの付与はありません</p>
      <footer className={FOOTER}><span>{device}</span>{summary.unpricedCalls > 0 && <span>単価不明 {summary.unpricedCalls} 回は除外</span>}</footer>
    </section>;
  }
  const negative = summary.remainingUsd < 0;
  const used = Math.min(1, Math.max(0, summary.usedRatio));
  const pace = PACE[summary.pace];
  return <section className={`${CARD} pace-${summary.pace}`}>
    <div className={HEAD}><span>今月のAPIクレジット</span><em className={CHIP}>{PLAN_LABELS[summary.plan]}</em></div>
    <strong className={FIGURE + (negative ? " negative text-danger" : " text-ink")}>{formatUsd(summary.remainingUsd)}<small className="ml-[4px] font-sans text-[10px] font-normal text-muted">残り</small></strong>
    <p className={"credit-sub " + NOTE}>/ {formatUsd(summary.monthlyAmountUsd)} · 推定使用 {formatUsd(summary.spentUsd)}</p>
    <div className="credit-bar relative mt-[6px] h-[6px] rounded-[3px] bg-line" role="img" aria-label={`使用率 ${Math.round(used * 100)}%、今日の目安 ${Math.round(summary.elapsedRatio * 100)}%`}>
      <span className={"credit-fill absolute top-0 bottom-0 left-0 rounded-[3px] " + pace.fill} style={{ width: `${used * 100}%` }} />
      <span className={"credit-marker absolute top-[-5px] ml-[-1px] h-[16px] w-[2px] rounded-[1px] " + pace.marker} style={{ left: `${summary.elapsedRatio * 100}%` }} />
    </div>
    <span className="credit-marker-label relative my-[2px] translate-x-[-50%] self-start text-[7px] whitespace-nowrap text-subtle" style={{ left: `${Math.min(80, Math.max(20, summary.elapsedRatio * 100))}%` }}>▲ 今日の目安</span>
    <span className={"pace-chip inline-flex items-center gap-[6px] self-start rounded-[10px] px-[9px] py-[3px] text-[9px] font-semibold " + pace.chip}><i className="size-[6px] rounded-full bg-current" />{PACE_LABEL[summary.pace]}</span>
    <p className={LINE + " text-ink-4"}>失効まで {summary.daysLeft}日 · {formatShortDate(summary.cycleEnd)} 頃</p>
    {negative
      ? <p className={LINE + " strong text-ink-3"}>付与分を超過（購入クレジット消費の可能性）</p>
      : summary.pace === "over"
        ? <p className={LINE + " strong text-ink-3"}>付与分に収めるなら 1日 <b className="text-ink">{formatUsd(summary.dailyBudgetUsd)}</b> 以内</p>
        : <p className={LINE + " strong text-ink-3"}>使い切るには 1日あたり <b className="text-ink">{formatUsd(summary.dailyBudgetUsd)}</b></p>}
    <footer className={FOOTER}>
      <span>{device}{summary.unpricedCalls > 0 ? ` · 単価不明 ${summary.unpricedCalls} 回` : ""}</span>
      <span>{summary.calibrated && summary.calibratedAt
        ? `Console残高で補正済み（${formatShortDate(summary.calibratedAt)} ${summary.calibratedAt.toTimeString().slice(0, 5)}）`
        : "推定値 · 正確な残高は Console の Billing で確認"}</span>
    </footer>
  </section>;
}
