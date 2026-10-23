import { PLAN_LABELS, formatShortDate, type CreditSummary } from "../lib/credit";
import { formatUsd } from "../lib/pricing";

type Totals = { inputTokens: number; outputTokens: number; calls: number; mcpCalls?: number };
type Props = { summary: CreditSummary | null; totals: Totals; onConfigure: () => void };

const PACE_LABEL = { under: "余りそうなペース", on: "順調なペース", over: "使いすぎペース" } as const;

function compactTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString();
}

export default function CreditCard({ summary, totals, onConfigure }: Props) {
  const device = `この端末 ${totals.calls}回${totals.mcpCalls ? `（うち MCP ${totals.mcpCalls}回）` : ""} · ${compactTokens(totals.inputTokens + totals.outputTokens)} tokens`;
  if (!summary) {
    return <section className="credit-card">
      <div className="credit-head"><span>今月のAPIクレジット</span></div>
      <strong className="credit-figure">未設定</strong>
      <p className="credit-note">月間付与額と付与日を設定すると、失効までの残額と消化ペースを表示します。</p>
      <button className="btn-primary credit-setup" onClick={onConfigure}>クレジットを設定</button>
      <footer><span>{device}</span><span>正確な残高は Console の Billing で確認</span></footer>
    </section>;
  }
  if (summary.plan === "none") {
    return <section className="credit-card">
      <div className="credit-head"><span>今月の推定利用額</span><em className="plan-chip">{PLAN_LABELS.none}</em></div>
      <strong className="credit-figure">{formatUsd(summary.spentUsd)}</strong>
      <p className="credit-note">{formatShortDate(summary.cycleStart)} 〜 {formatShortDate(summary.cycleEnd)} · APIクレジットの付与はありません</p>
      <footer><span>{device}</span>{summary.unpricedCalls > 0 && <span>単価不明 {summary.unpricedCalls} 回は除外</span>}</footer>
    </section>;
  }
  const negative = summary.remainingUsd < 0;
  const used = Math.min(1, Math.max(0, summary.usedRatio));
  return <section className={`credit-card pace-${summary.pace}`}>
    <div className="credit-head"><span>今月のAPIクレジット</span><em className="plan-chip">{PLAN_LABELS[summary.plan]}</em></div>
    <strong className={"credit-figure" + (negative ? " negative" : "")}>{formatUsd(summary.remainingUsd)}<small>残り</small></strong>
    <p className="credit-sub">/ {formatUsd(summary.monthlyAmountUsd)} · 推定使用 {formatUsd(summary.spentUsd)}</p>
    <div className="credit-bar" role="img" aria-label={`使用率 ${Math.round(used * 100)}%、今日の目安 ${Math.round(summary.elapsedRatio * 100)}%`}>
      <span className="credit-fill" style={{ width: `${used * 100}%` }} />
      <span className="credit-marker" style={{ left: `${summary.elapsedRatio * 100}%` }} />
    </div>
    <span className="credit-marker-label" style={{ left: `${Math.min(80, Math.max(20, summary.elapsedRatio * 100))}%` }}>▲ 今日の目安</span>
    <span className="pace-chip"><i />{PACE_LABEL[summary.pace]}</span>
    <p className="credit-line">失効まで {summary.daysLeft}日 · {formatShortDate(summary.cycleEnd)} 頃</p>
    {negative
      ? <p className="credit-line strong">付与分を超過（購入クレジット消費の可能性）</p>
      : summary.pace === "over"
        ? <p className="credit-line strong">付与分に収めるなら 1日 <b>{formatUsd(summary.dailyBudgetUsd)}</b> 以内</p>
        : <p className="credit-line strong">使い切るには 1日あたり <b>{formatUsd(summary.dailyBudgetUsd)}</b></p>}
    <footer>
      <span>{device}{summary.unpricedCalls > 0 ? ` · 単価不明 ${summary.unpricedCalls} 回` : ""}</span>
      <span>{summary.calibrated && summary.calibratedAt
        ? `Console残高で補正済み（${formatShortDate(summary.calibratedAt)} ${summary.calibratedAt.toTimeString().slice(0, 5)}）`
        : "推定値 · 正確な残高は Console の Billing で確認"}</span>
    </footer>
  </section>;
}
