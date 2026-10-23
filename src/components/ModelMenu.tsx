import { Check, ChevronDown, RefreshCw } from "lucide-react";
import { usePopover } from "./Popover";
import { priceHint } from "../lib/pricing";
import { useT, type Messages } from "../i18n";

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
function describe(id: string, t: Messages): string {
  if (id.includes("opus")) return t.menus.model.describeOpus;
  if (id.includes("sonnet")) return t.menus.model.describeSonnet;
  if (id.includes("haiku")) return t.menus.model.describeHaiku;
  return "";
}

/** Model picker popover modeled on the Claude apps: model list with descriptions, then thinking depth. */
export default function ModelMenu(p: Props) {
  const t = useT();
  const { open, setOpen, ref } = usePopover();
  const current = p.models.find(m => m.value === p.model);
  const effortLabel = p.efforts.find(e => e.value === p.effort && e.value)?.label;
  return <div className="model-menu relative" ref={ref}>
    <button className={"model-trigger inline-flex max-w-[240px] items-center gap-[5px] whitespace-nowrap rounded-[8px] border-0 px-[8px] py-[6px] font-sans text-[13px] font-medium text-ink-3 enabled:hover:bg-line" + (open ? " on bg-line" : " bg-transparent")} disabled={p.disabled} aria-haspopup="menu" aria-expanded={open} aria-label={t.menus.model.select}
      onClick={() => setOpen(v => !v)}>
      <span className="overflow-hidden text-ellipsis">{p.modelsLoading && !current ? t.menus.model.fetching : shortModelName(current?.label ?? p.model)}</span>
      {effortLabel && <small className="text-[11.5px] font-normal text-subtle @max-[520px]:hidden">{effortLabel}</small>}
      <ChevronDown size={13} className="shrink-0 text-subtle" />
    </button>
    {open && <div className={"menu model-pop right-0 max-h-[min(460px,70vh)] w-[310px] overflow-auto " + (p.placement === "down" ? "down" : "up")} role="menu">
      <div className="menu-label">{t.menus.model.models}</div>
      {p.models.map(m => <button key={m.value} role="menuitemradio" aria-checked={m.value === p.model} className="menu-item rich items-start px-[10px] py-[9px]"
        onClick={() => { p.onModel(m.value); setOpen(false); }}>
        <span className="flex min-w-0 flex-1 flex-col gap-[2px]"><b className="text-[13.5px] font-medium text-ink">{shortModelName(m.label)}</b><small className="text-[11.5px] text-muted">{describe(m.value, t) || m.value}</small>{priceHint(m.value) && <small className="faint text-[10.5px] text-subtle">{priceHint(m.value)}</small>}</span>
        {m.value === p.model && <Check size={16} className="menu-check" />}
      </button>)}
      {p.efforts.length > 1 && <>
        <div className="menu-sep" />
        <div className="menu-label">{t.menus.model.effort}<small>{t.menus.model.effortHint}</small></div>
        <div className="effort-row mx-[6px] mt-[2px] mb-[6px] flex gap-[2px] rounded-[9px] border border-line bg-inset p-[3px]" role="group" aria-label={t.menus.model.effort}>
          {p.efforts.map(e => <button key={e.value} className={"flex-1 whitespace-nowrap rounded-[7px] border-0 px-[2px] py-[6px] text-[11.5px] hover:text-ink " + (e.value === p.effort ? "active bg-raised text-ink shadow-[0_1px_2px_#0005]" : "bg-transparent text-muted")} onClick={() => p.onEffort(e.value)}>{e.label.replace(/^[^:]*: /, "")}</button>)}
        </div>
      </>}
      <div className="menu-sep" />
      <button className="menu-item" onClick={p.onRefresh} disabled={p.modelsLoading}><RefreshCw size={14} className={p.modelsLoading ? "spin animate-spin" : ""} />{t.menus.model.refresh}</button>
    </div>}
  </div>;
}
