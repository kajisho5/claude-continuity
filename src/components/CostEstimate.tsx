import { useT } from "../i18n";

export type EstimateView = { tokens: string; usd: string; batch: boolean; withoutTools: boolean };

/** The line under the composer: what sending would cost (input, counted with count_tokens) and today's spending against the limits. */
export default function CostEstimate({ estimate, counting, limits }: { estimate: EstimateView | null; counting: boolean; limits: string }) {
  const t = useT();
  const e = t.spend.estimate;
  if (!estimate && !counting && !limits) return null;
  return <div className="cost-estimate mx-auto mt-[6px] flex w-full max-w-[760px] flex-col gap-[2px] px-[10px] text-[11px] leading-[1.6] text-subtle" title={e.detail}>
    {estimate
      ? <span className="cost-estimate-line">{e.line(estimate.tokens, estimate.usd)}{estimate.batch ? e.batchNote : ""}{estimate.withoutTools ? e.withoutTools : ""}</span>
      : counting && <span className="cost-estimate-line">{e.counting}</span>}
    {limits && <span className="cost-limits text-faint">{limits}</span>}
  </div>;
}
