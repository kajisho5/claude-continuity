import { useEffect, useRef, useState } from "react";
import { BarChart3, Brain, FileSpreadsheet, Globe, Search, SlidersHorizontal } from "lucide-react";

export type Tools = { webSearch?: boolean; webFetch?: boolean; files?: boolean; analysis?: boolean; memory?: boolean };
type Key = keyof Tools;
const ITEMS: { key: Key; title: string; desc: string; icon: typeof Search; chip: string }[] = [
  { key: "webSearch", title: "Web 検索", desc: "出典付きで最新情報を調べる · 1,000回 $10", icon: Search, chip: "Web検索" },
  { key: "webFetch", title: "URL の読み込み", desc: "会話に出てきた URL の本文を読む", icon: Globe, chip: "URL読込" },
  { key: "files", title: "ファイル作成（Skills）", desc: "Excel・Word・PowerPoint・PDF を作る", icon: FileSpreadsheet, chip: "ファイル作成" },
  { key: "analysis", title: "データ分析", desc: "添付した CSV や Excel を Python で集計する", icon: BarChart3, chip: "データ分析" },
  { key: "memory", title: "メモリ", desc: "会話をまたいで覚えておく（設定で確認・削除）", icon: Brain, chip: "メモリ" }
];

export default function ToolsMenu({ tools, onChange, disabled, projectMemory }: { tools: Tools; onChange: (next: Tools) => void; disabled?: boolean; projectMemory?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", onKey, true); };
  }, [open]);
  const active = ITEMS.filter(item => tools[item.key] || (item.key === "memory" && projectMemory));
  return <div className="tools" ref={ref}>
    <button className={"round-btn tip" + (open ? " on" : "")} data-tip="ツール" aria-label="ツール" disabled={disabled} onClick={() => setOpen(v => !v)} aria-expanded={open}><SlidersHorizontal size={15} /></button>
    {active.map(item => <button key={item.key} className="tool-chip tip" disabled={disabled || (item.key === "memory" && projectMemory)}
      data-tip={item.key === "memory" && projectMemory ? `${item.chip}（プロジェクトの設定でオン）` : `${item.chip}（クリックでオフ）`} aria-label={item.chip}
      onClick={() => onChange({ ...tools, [item.key]: false })}>
      <item.icon size={12} /><span className="chip-label">{item.chip}</span></button>)}
    {open && <div className="tools-menu" role="menu">
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
