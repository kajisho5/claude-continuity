import { ChevronsUpDown, FileUp, RotateCcw, Settings2 } from "lucide-react";
import { usePopover } from "./Popover";

type Props = { name: string; plan: string; configured: boolean; onSettings: () => void; onImport: () => void; onOnboarding: () => void };

/** Account row at the bottom of the sidebar; opens upward like the Claude apps. */
export default function AccountMenu(p: Props) {
  const { open, setOpen, ref } = usePopover();
  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  const initial = (p.name.trim()[0] ?? "U").toUpperCase();
  return <div className="account" ref={ref}>
    {open && <div className="menu account-pop up" role="menu">
      <div className="menu-label">{p.name || "ユーザー"}<small>{p.configured ? "API キー設定済み" : "API キー未設定"}</small></div>
      <button className="menu-item" role="menuitem" onClick={run(p.onSettings)}><Settings2 size={15} />設定<span className={"dot menu-tail " + (p.configured ? "green" : "")} /></button>
      <button className="menu-item" role="menuitem" onClick={run(p.onImport)}><FileUp size={15} />エクスポートを読み込む</button>
      <button className="menu-item" role="menuitem" onClick={run(p.onOnboarding)}><RotateCcw size={15} />初期設定をやり直す</button>
    </div>}
    <button className={"account-row" + (open ? " on" : "")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
      <span className="initial">{initial}</span>
      <span className="who"><b>{p.name || "ユーザー"}</b><small>{p.plan}</small></span>
      <ChevronsUpDown size={15} />
    </button>
  </div>;
}
