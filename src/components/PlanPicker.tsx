import { Check } from "lucide-react";
import type { PlanId } from "../lib/credit";
import { useT, type Messages } from "../i18n";

type Option = { id: PlanId; title: string; amount: string; unit: string; lines: [string, string]; muted?: boolean };
const options = ({ credit: { plans: p } }: Messages): Option[] => [
  { id: "max5x", title: "Max 5x", amount: "$100", unit: p.perMonth, lines: [p.expiresNoRollover, p.notForClaudeCode] },
  { id: "max20x", title: "Max 20x", amount: "$200", unit: p.perMonth, lines: [p.expiresNoRollover, p.notForClaudeCode] },
  { id: "team", title: "Team", amount: p.teamAmount, unit: p.teamUnit, lines: [p.teamSeats, p.teamNext] },
  { id: "none", title: p.otherTitle, amount: p.otherAmount, unit: "", lines: [p.otherNoCredits, p.otherTrackOnly], muted: true }
];

export default function PlanPicker({ value, onChange }: { value: PlanId | null; onChange: (plan: PlanId) => void }) {
  const t = useT();
  return <div className="plan-grid grid grid-cols-[1fr_1fr] gap-[16px] [@media(max-width:1000px)]:grid-cols-[1fr]" role="radiogroup" aria-label={t.credit.plans.label}>
    {options(t).map(option => {
      const selected = value === option.id;
      return <button key={option.id} type="button" role="radio" aria-checked={selected}
        className={"plan-option relative flex flex-col items-start gap-[2px] rounded-[12px] text-left text-ink-2"
          + (selected ? " selected border-2 border-accent bg-surface px-[17px] py-[15px]" : " border border-line-strong bg-sidebar px-[18px] py-[16px] hover:border-line-input")
          // "muted" is also the shared .muted text class, which sets this button's size and bottom margin.
          + (option.muted ? " muted mt-0 mb-[6px] text-[11px]" : "")} onClick={() => onChange(option.id)}>
        <span className="plan-title font-serif text-[14px] font-bold text-ink">{option.title}</span>
        <span className={"plan-radio absolute top-[14px] right-[14px] grid size-[20px] place-items-center rounded-full border-[1.5px] " + (selected ? "border-accent bg-accent text-on-accent" : "border-line-input")}>{selected && <Check size={13} strokeWidth={3} />}</span>
        <span className={"plan-amount m-[6px_0_4px] font-serif text-[26px] font-bold tracking-[-.6px] " + (option.muted ? "text-muted" : "text-ink")}>{option.amount}{option.unit && <small className="ml-[6px] font-sans text-[10px] font-normal tracking-[0] text-muted">{option.unit}</small>}</span>
        <span className="plan-line text-[10px] text-muted">{option.lines[0]}</span>
        <span className="plan-line dim text-[10px] text-subtle">{option.lines[1]}</span>
      </button>;
    })}
  </div>;
}
