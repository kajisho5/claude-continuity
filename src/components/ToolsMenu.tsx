import { useState } from "react";
import { BarChart3, Brain, Check, ChevronRight, FileSpreadsheet, Globe, PenLine, Search, SlidersHorizontal } from "lucide-react";
import { usePopover } from "./Popover";

export type Tools = { webSearch?: boolean; webFetch?: boolean; files?: boolean; analysis?: boolean; memory?: boolean };
type Key = keyof Tools;
type Option = { value: string; label: string };
const ITEMS: { key: Key; title: string; desc: string; icon: typeof Search; chip: string }[] = [
  { key: "webSearch", title: "Web 検索", desc: "出典付きで最新情報を調べる · 1,000回 $10", icon: Search, chip: "Web検索" },
  { key: "webFetch", title: "URL の読み込み", desc: "会話に出てきた URL の本文を読む", icon: Globe, chip: "URL読込" },
  { key: "files", title: "ファイル作成（Skills）", desc: "Excel・Word・PowerPoint・PDF を作る", icon: FileSpreadsheet, chip: "ファイル作成" },
  { key: "analysis", title: "データ分析", desc: "添付した CSV や Excel を Python で集計する", icon: BarChart3, chip: "データ分析" },
  { key: "memory", title: "メモリ", desc: "会話をまたいで覚えておく（設定で確認・削除）", icon: Brain, chip: "メモリ" }
];

type Props = {
  tools: Tools; onChange: (next: Tools) => void; disabled?: boolean; projectMemory?: boolean;
  style: string; styles: Option[]; onStyle: (v: string) => void; placement?: "up" | "down";
};

export default function ToolsMenu({ tools, onChange, disabled, projectMemory, style, styles, onStyle, placement }: Props) {
  const { open, setOpen, ref } = usePopover();
  const [stylesOpen, setStylesOpen] = useState(false);
  const active = ITEMS.filter(item => tools[item.key] || (item.key === "memory" && projectMemory));
  const styleLabel = style !== "standard" ? styles.find(s => s.value === style)?.label : undefined;
  return <div className="tools" ref={ref}>
    <button className={"round-btn tip" + (open ? " on" : "")} data-tip="ツール" aria-label="ツール" disabled={disabled} aria-expanded={open}
      onClick={() => { setOpen(v => !v); setStylesOpen(false); }}><SlidersHorizontal size={15} /></button>
    {styleLabel && <button className="tool-chip style-chip tip" disabled={disabled} data-tip={`スタイル: ${styleLabel}（クリックで標準に戻す）`} aria-label={`スタイル ${styleLabel}`}
      onClick={() => onStyle("standard")}><PenLine size={12} /><span className="chip-label">{styleLabel}</span></button>}
    {active.map(item => <button key={item.key} className="tool-chip tip" disabled={disabled || (item.key === "memory" && projectMemory)}
      data-tip={item.key === "memory" && projectMemory ? `${item.chip}（プロジェクトの設定でオン）` : `${item.chip}（クリックでオフ）`} aria-label={item.chip}
      onClick={() => onChange({ ...tools, [item.key]: false })}>
      <item.icon size={12} /><span className="chip-label">{item.chip}</span></button>)}
    {open && <div className={"menu tools-menu " + (placement === "down" ? "down" : "up")} role="menu">
      <button className="menu-item tools-style" aria-expanded={stylesOpen} onClick={() => setStylesOpen(v => !v)}>
        <PenLine size={16} /><span><b>スタイルを使用</b><small>{styleLabel ?? "標準"}</small></span>
        <ChevronRight size={15} className={"chev-r" + (stylesOpen ? " open" : "")} />
      </button>
      {stylesOpen && <div className="style-list">{styles.map(s => <button key={s.value} className="menu-item" role="menuitemradio" aria-checked={s.value === style}
        onClick={() => { onStyle(s.value); setOpen(false); }}>{s.label}{s.value === style && <Check size={15} className="menu-check" />}</button>)}</div>}
      <div className="menu-sep" />
      {ITEMS.map(item => {
        const on = !!tools[item.key] || (item.key === "memory" && !!projectMemory);
        return <label key={item.key} className="tools-item">
          <item.icon size={16} />
          <span><b>{item.title}</b><small>{item.key === "memory" && projectMemory ? "プロジェクトの設定でオン" : item.desc}</small></span>
          <input type="checkbox" className="switch" checked={on} disabled={item.key === "memory" && projectMemory}
            onChange={e => onChange({ ...tools, [item.key]: e.target.checked })} />
        </label>;
      })}
    </div>}
  </div>;
}
