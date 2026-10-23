import { ChevronsUpDown, FileUp, Keyboard, RotateCcw, Settings2 } from "lucide-react";
import { usePopover } from "./Popover";
import { useT } from "../i18n";

type Props = { name: string; plan: string; configured: boolean; onSettings: () => void; onShortcuts: () => void; onImport: () => void; onOnboarding: () => void };

/** Account row at the bottom of the sidebar; opens upward like the Claude apps. */
export default function AccountMenu(p: Props) {
  const t = useT();
  const { open, setOpen, ref } = usePopover();
  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  const initial = (p.name.trim()[0] ?? "U").toUpperCase();
  return <div className="account relative mt-[10px] shrink-0 border-t border-line pt-[8px]" ref={ref}>
    {open && <div className="menu account-pop up right-0 left-0 min-w-0" role="menu">
      <div className="menu-label">{p.name || t.menus.account.defaultName}<small>{p.configured ? t.menus.account.keyConfigured : t.menus.account.keyMissing}</small></div>
      <button className="menu-item" role="menuitem" onClick={run(p.onSettings)}><Settings2 size={15} />{t.menus.account.settings}<span className={"dot menu-tail " + (p.configured ? "green" : "")} /></button>
      <button className="menu-item" role="menuitem" onClick={run(p.onShortcuts)}><Keyboard size={15} />{t.menus.account.shortcuts}</button>
      <button className="menu-item" role="menuitem" onClick={run(p.onImport)}><FileUp size={15} />{t.menus.account.importExport}</button>
      <button className="menu-item" role="menuitem" onClick={run(p.onOnboarding)}><RotateCcw size={15} />{t.menus.account.redoOnboarding}</button>
    </div>}
    <button className={"account-row flex w-full items-center gap-[10px] rounded-[10px] border-0 px-[8px] py-[7px] text-left text-muted hover:bg-line" + (open ? " on bg-line" : " bg-transparent")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
      <span className="initial grid size-[30px] shrink-0 place-items-center rounded-full bg-avatar font-sans text-[13px] font-semibold text-[#1D1C1A] light:text-[#FAF9F5]">{initial}</span>
      <span className="who flex min-w-0 flex-1 flex-col gap-[1px]"><b className="truncate text-[13px] font-medium text-ink-2">{p.name || t.menus.account.defaultName}</b><small className="text-[11px] text-subtle">{p.plan}</small></span>
      <ChevronsUpDown size={15} />
    </button>
  </div>;
}
