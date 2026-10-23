import { Check } from "lucide-react";
import type { PlanId } from "../lib/credit";

type Option = { id: PlanId; title: string; amount: string; unit: string; lines: [string, string]; muted?: boolean };
const OPTIONS: Option[] = [
  { id: "max5x", title: "Max 5x", amount: "$100", unit: "/ 月の APIクレジット", lines: ["請求サイクル末で失効・繰り越しなし", "Claude Code には使えません"] },
  { id: "max20x", title: "Max 20x", amount: "$200", unit: "/ 月の APIクレジット", lines: ["請求サイクル末で失効・繰り越しなし", "Claude Code には使えません"] },
  { id: "team", title: "Team", amount: "最大 $500", unit: "/ 月（全席合算）", lines: ["Standard 席 $20・Premium 席 $100", "次の画面で合計額を入力します"] },
  { id: "none", title: "Pro / Free / その他", amount: "対象外", unit: "", lines: ["APIクレジットは付与されません", "利用額の記録だけ行います"], muted: true }
];

export default function PlanPicker({ value, onChange }: { value: PlanId | null; onChange: (plan: PlanId) => void }) {
  return <div className="plan-grid" role="radiogroup" aria-label="Claudeのプラン">
    {OPTIONS.map(option => {
      const selected = value === option.id;
      return <button key={option.id} type="button" role="radio" aria-checked={selected}
        className={"plan-option" + (selected ? " selected" : "") + (option.muted ? " muted" : "")} onClick={() => onChange(option.id)}>
        <span className="plan-title">{option.title}</span>
        <span className="plan-radio">{selected && <Check size={13} strokeWidth={3} />}</span>
        <span className="plan-amount">{option.amount}{option.unit && <small>{option.unit}</small>}</span>
        <span className="plan-line">{option.lines[0]}</span>
        <span className="plan-line dim">{option.lines[1]}</span>
      </button>;
    })}
  </div>;
}
