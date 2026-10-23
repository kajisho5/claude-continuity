import { useState } from "react";
import { BarChart3, Brain, Check, ChevronRight, FileSpreadsheet, Globe, PenLine, Plug, Plus, Search, SlidersHorizontal } from "lucide-react";
import { usePopover } from "./Popover";

export type Tools = { webSearch?: boolean; webFetch?: boolean; files?: boolean; analysis?: boolean; memory?: boolean; connectors?: string[] };
export type ConnectorOption = { id: string; name: string };
type Key = Exclude<keyof Tools, "connectors">;
type Option = { value: string; label: string };
const ITEMS: { key: Key; title: string; desc: string; icon: typeof Search; chip: string }[] = [
  { key: "webSearch", title: "Web 検索", desc: "出典付きで最新情報を調べる · 1,000回 $10", icon: Search, chip: "Web検索" },
  { key: "webFetch", title: "URL の読み込み", desc: "会話に出てきた URL の本文を読む", icon: Globe, chip: "URL読込" },
  { key: "files", title: "ファイル作成（Skills）", desc: "Excel・Word・PowerPoint・PDF を作る", icon: FileSpreadsheet, chip: "ファイル作成" },
  { key: "analysis", title: "データ分析", desc: "添付した CSV や Excel を Python で集計する", icon: BarChart3, chip: "データ分析" },
  { key: "memory", title: "メモリ", desc: "会話をまたいで覚えておく（設定で確認・削除）", icon: Brain, chip: "メモリ" }
];

// Legacy .tool-chip (+ light override and the composer @container rules); the composer root is the container.
const CHIP = "inline-flex items-center gap-[5px] whitespace-nowrap rounded-[12px] border px-[10px] py-[4px] text-[10px] font-semibold @max-[680px]:px-[7px] @max-[680px]:py-[6px] light:bg-accent/12";
const CHIP_ON = "border-accent/55 bg-accent/16 text-link";
const LABEL = "chip-label @max-[680px]:hidden";
const ITEM = "tools-item flex cursor-pointer items-center gap-[12px] rounded-[8px] p-[10px] text-ink-3 hover:bg-surface";
const ITEM_TEXT = "flex flex-1 flex-col gap-[2px]";
const ITEM_TITLE = "text-[12px] text-ink-2";
const ITEM_DESC = "text-[9.5px] text-muted";
export const STYLE_LIST = "style-list flex flex-col pl-[26px] animate-[fadeIn_.15s_ease]";
export const STYLE_ITEM = "px-[10px] py-[7px] text-[12.5px]";

type Props = {
  tools: Tools; onChange: (next: Tools) => void; disabled?: boolean; projectMemory?: boolean;
  style: string; styles: Option[]; onStyle: (v: string) => void; placement?: "up" | "down";
  connectors?: ConnectorOption[]; onManageConnectors?: () => void;
};

export default function ToolsMenu({ tools, onChange, disabled, projectMemory, style, styles, onStyle, placement, connectors = [], onManageConnectors }: Props) {
  const { open, setOpen, ref } = usePopover();
  const [stylesOpen, setStylesOpen] = useState(false);
  const active = ITEMS.filter(item => tools[item.key] || (item.key === "memory" && projectMemory));
  const activeConnectors = connectors.filter(c => tools.connectors?.includes(c.id));
  const toggleConnector = (id: string, on: boolean) => onChange({ ...tools, connectors: on ? [...new Set([...(tools.connectors ?? []), id])] : (tools.connectors ?? []).filter(x => x !== id) });
  const styleLabel = style !== "standard" ? styles.find(s => s.value === style)?.label : undefined;
  return <div className="tools relative flex min-w-0 flex-nowrap items-center gap-[4px]" ref={ref}>
    <button className={"round-btn tip" + (open ? " on" : "")} data-tip="ツール" aria-label="ツール" disabled={disabled} aria-expanded={open}
      onClick={() => { setOpen(v => !v); setStylesOpen(false); }}><SlidersHorizontal size={15} /></button>
    {styleLabel && <button className={"tool-chip style-chip tip " + CHIP + " border-line-strong bg-raised text-ink-3"} disabled={disabled} data-tip={`スタイル: ${styleLabel}（クリックで標準に戻す）`} aria-label={`スタイル ${styleLabel}`}
      onClick={() => onStyle("standard")}><PenLine size={12} /><span className={LABEL}>{styleLabel}</span></button>}
    {active.map(item => <button key={item.key} className={"tool-chip tip " + CHIP + " " + CHIP_ON} disabled={disabled || (item.key === "memory" && projectMemory)}
      data-tip={item.key === "memory" && projectMemory ? `${item.chip}（プロジェクトの設定でオン）` : `${item.chip}（クリックでオフ）`} aria-label={item.chip}
      onClick={() => onChange({ ...tools, [item.key]: false })}>
      <item.icon size={12} /><span className={LABEL}>{item.chip}</span></button>)}
    {activeConnectors.map(c => <button key={c.id} className={"tool-chip tip " + CHIP + " " + CHIP_ON} disabled={disabled} data-tip={`${c.name}（クリックでオフ）`} aria-label={c.name}
      onClick={() => toggleConnector(c.id, false)}><Plug size={12} /><span className={LABEL}>{c.name}</span></button>)}
    {open && <div className={"menu tools-menu left-0 w-[340px] " + (placement === "down" ? "down" : "up")} role="menu">
      <button className="menu-item tools-style" aria-expanded={stylesOpen} onClick={() => setStylesOpen(v => !v)}>
        <PenLine size={16} /><span className="flex flex-1 flex-col gap-[2px]"><b className="text-[12px] font-semibold text-ink-2">スタイルを使用</b><small className="text-[9.5px] text-muted">{styleLabel ?? "標準"}</small></span>
        <ChevronRight size={15} className={"chev-r ml-auto transition-transform duration-[180ms] ease-claude" + (stylesOpen ? " open rotate-90" : "")} />
      </button>
      {stylesOpen && <div className={STYLE_LIST}>{styles.map(s => <button key={s.value} className={"menu-item " + STYLE_ITEM} role="menuitemradio" aria-checked={s.value === style}
        onClick={() => { onStyle(s.value); setOpen(false); }}>{s.label}{s.value === style && <Check size={15} className="menu-check" />}</button>)}</div>}
      <div className="menu-sep" />
      {ITEMS.map(item => {
        const on = !!tools[item.key] || (item.key === "memory" && !!projectMemory);
        return <label key={item.key} className={ITEM}>
          <item.icon size={16} />
          <span className={ITEM_TEXT}><b className={ITEM_TITLE}>{item.title}</b><small className={ITEM_DESC}>{item.key === "memory" && projectMemory ? "プロジェクトの設定でオン" : item.desc}</small></span>
          <input type="checkbox" className="switch" checked={on} disabled={item.key === "memory" && projectMemory}
            onChange={e => onChange({ ...tools, [item.key]: e.target.checked })} />
        </label>;
      })}
      <div className="menu-sep" />
      <div className="menu-label">コネクタ</div>
      {connectors.map(c => <label key={c.id} className={ITEM}>
        <Plug size={16} /><span className={ITEM_TEXT}><b className={ITEM_TITLE}>{c.name}</b><small className={ITEM_DESC}>この会話で使う</small></span>
        <input type="checkbox" className="switch" checked={!!tools.connectors?.includes(c.id)} onChange={e => toggleConnector(c.id, e.target.checked)} />
      </label>)}
      {onManageConnectors && <button className="menu-item" onClick={() => { setOpen(false); onManageConnectors(); }}><Plus size={15} />{connectors.length ? "コネクタを管理" : "コネクタを追加（Notion・社内 MCP サーバーなど）"}</button>}
    </div>}
  </div>;
}
