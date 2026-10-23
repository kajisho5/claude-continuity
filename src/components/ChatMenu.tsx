import { useState, type CSSProperties } from "react";
import { Check, ChevronDown, Download, Share, FolderOpen, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { usePopover } from "./Popover";
import { STYLE_ITEM, STYLE_LIST } from "./ToolsMenu";
import { useT } from "../i18n";

type Props = {
  title: string; starred: boolean; variant: "row" | "title";
  projects: { id: string; name: string }[]; projectId?: string;
  onStar: () => void; onRename: () => void; onExport: () => void; onExportHtml: () => void; onDelete: () => void; onMoveProject: (id: string | undefined) => void;
};

/** Per-chat actions, opened from a sidebar row's "…" button or the header title, like the Claude apps. */
export default function ChatMenu(p: Props) {
  const t = useT();
  const { open, setOpen, ref } = usePopover();
  const [moving, setMoving] = useState(false);
  // Sidebar rows live in a clipped scroll area, so their menu is positioned against the viewport.
  const [fixed, setFixed] = useState<CSSProperties | undefined>(undefined);
  function toggleRow(button: HTMLElement) {
    const r = button.getBoundingClientRect();
    const below = window.innerHeight - r.bottom > 300;
    setFixed({ position: "fixed", left: Math.max(8, r.left - 4), ...(below ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }) });
    setOpen(v => !v);
  }
  const run = (fn: () => void) => () => { setOpen(false); setMoving(false); fn(); };
  // Row variant: no transform here, it would become the containing block of the fixed-position menu.
  const root = p.variant === "row" ? "absolute inset-y-0 right-[4px] flex items-center" : "relative flex min-w-0";
  return <div className={"chat-menu " + p.variant + (open ? " open" : "") + " " + root} ref={ref}>
    {p.variant === "title"
      ? <button className={"title-trigger inline-flex min-w-0 max-w-[min(560px,60vw)] items-center gap-[6px] rounded-[8px] border-0 px-[8px] py-[6px] font-sans text-[13.5px] font-medium text-ink-2 hover:bg-line " + (open ? "bg-line" : "bg-transparent")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        {p.starred && <Star size={13} className="star-on shrink-0 text-warn" fill="currentColor" />}<span className="truncate">{p.title}</span><ChevronDown size={14} className="shrink-0 text-subtle" /></button>
      : <button className={"row-more grid size-[26px] place-items-center rounded-[6px] border-0 p-0 hover:bg-line-strong hover:text-ink " + (open ? "bg-line-strong text-ink opacity-100" : "bg-transparent text-muted opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100")} aria-label={t.menus.chat.menuFor(p.title)} aria-haspopup="menu" aria-expanded={open}
        onClick={e => { e.stopPropagation(); toggleRow(e.currentTarget); }}><MoreHorizontal size={16} /></button>}
    {open && <div className={"menu chat-pop" + (p.variant === "row" ? " fixed" : " down left-0 w-[230px]")} style={p.variant === "row" ? fixed : undefined} role="menu" onClick={e => e.stopPropagation()}>
      <button className="menu-item" role="menuitem" onClick={run(p.onStar)}><Star size={15} />{p.starred ? t.menus.chat.unstar : t.menus.chat.star}</button>
      <button className="menu-item" role="menuitem" onClick={run(p.onRename)}><Pencil size={15} />{t.menus.chat.rename}</button>
      <button className="menu-item" role="menuitem" aria-expanded={moving} onClick={() => setMoving(v => !v)}><FolderOpen size={15} />{t.menus.chat.moveToProject}<ChevronDown size={13} className={"menu-tail" + (moving ? " open" : "")} /></button>
      {moving && <div className={STYLE_LIST}>
        <button className={"menu-item " + STYLE_ITEM} onClick={run(() => p.onMoveProject(undefined))}>{t.menus.chat.noProject}{!p.projectId && <Check size={14} className="menu-check" />}</button>
        {p.projects.map(pr => <button key={pr.id} className={"menu-item " + STYLE_ITEM} onClick={run(() => p.onMoveProject(pr.id))}><span className="ellipsis min-w-0 truncate">{pr.name}</span>{p.projectId === pr.id && <Check size={14} className="menu-check" />}</button>)}
      </div>}
      <button className="menu-item" role="menuitem" onClick={run(p.onExport)}><Download size={15} />{t.menus.chat.exportJson}</button>
      <button className="menu-item" role="menuitem" onClick={run(p.onExportHtml)}><Share size={15} />{t.menus.chat.exportHtml}</button>
      <div className="menu-sep" />
      <button className="menu-item danger" role="menuitem" onClick={run(p.onDelete)}><Trash2 size={15} />{t.common.delete}</button>
    </div>}
  </div>;
}
