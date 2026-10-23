import { Check, ChevronDown, RefreshCw } from "lucide-react";
import { usePopover } from "./Popover";
import { priceHint } from "../lib/pricing";

type Option = { value: string; label: string };
type Props = {
  model: string; models: Option[]; onModel: (v: string) => void; modelsLoading: boolean; onRefresh: () => void;
  effort: string; efforts: Option[]; onEffort: (v: string) => void;
  disabled?: boolean; placement?: "up" | "down";
};

/** Short label in the composer: "Claude Opus 5.5" → "Opus 5.5". */
export function shortModelName(label: string): string {
  return label.replace(/^Claude\s+/i, "");
}
function describe(id: string): string {
  if (id.includes("opus")) return "複雑な作業に最も強いモデル";
  if (id.includes("sonnet")) return "日常の作業に賢く効率的";
  if (id.includes("haiku")) return "すばやい回答に最適な最速モデル";
  return "";
}

/** Model picker popover modeled on the Claude apps: model list with descriptions, then thinking depth. */
export default function ModelMenu(p: Props) {
  const { open, setOpen, ref } = usePopover();
  const current = p.models.find(m => m.value === p.model);
  const effortLabel = p.efforts.find(e => e.value === p.effort && e.value)?.label;
  return <div className="model-menu" ref={ref}>
    <button className={"model-trigger" + (open ? " on" : "")} disabled={p.disabled} aria-haspopup="menu" aria-expanded={open} aria-label="モデルを選択"
      onClick={() => setOpen(v => !v)}>
      <span>{p.modelsLoading && !current ? "取得中…" : shortModelName(current?.label ?? p.model)}</span>
      {effortLabel && <small>{effortLabel}</small>}
      <ChevronDown size={13} />
    </button>
    {open && <div className={"menu model-pop " + (p.placement === "down" ? "down" : "up")} role="menu">
      <div className="menu-label">モデル</div>
      {p.models.map(m => <button key={m.value} role="menuitemradio" aria-checked={m.value === p.model} className="menu-item rich"
        onClick={() => { p.onModel(m.value); setOpen(false); }}>
        <span><b>{shortModelName(m.label)}</b><small>{describe(m.value) || m.value}</small>{priceHint(m.value) && <small className="faint">{priceHint(m.value)}</small>}</span>
        {m.value === p.model && <Check size={16} className="menu-check" />}
      </button>)}
      {p.efforts.length > 1 && <>
        <div className="menu-sep" />
        <div className="menu-label">思考の深さ<small>深いほど質が上がり、クレジットを多く使います</small></div>
        <div className="effort-row" role="group" aria-label="思考の深さ">
          {p.efforts.map(e => <button key={e.value} className={e.value === p.effort ? "active" : ""} onClick={() => p.onEffort(e.value)}>{e.label.replace(/^思考: /, "")}</button>)}
        </div>
      </>}
      <div className="menu-sep" />
      <button className="menu-item" onClick={p.onRefresh} disabled={p.modelsLoading}><RefreshCw size={14} className={p.modelsLoading ? "spin" : ""} />モデル一覧を更新</button>
    </div>}
  </div>;
}
