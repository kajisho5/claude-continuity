import { useState, type CSSProperties } from "react";
import { Check, ChevronDown, Download, FolderOpen, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { usePopover } from "./Popover";

type Props = {
  title: string; starred: boolean; variant: "row" | "title";
  projects: { id: string; name: string }[]; projectId?: string;
  onStar: () => void; onRename: () => void; onExport: () => void; onDelete: () => void; onMoveProject: (id: string | undefined) => void;
};

/** Per-chat actions, opened from a sidebar row's "…" button or the header title, like the Claude apps. */
export default function ChatMenu(p: Props) {
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
  return <div className={"chat-menu " + p.variant + (open ? " open" : "")} ref={ref}>
    {p.variant === "title"
      ? <button className="title-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        {p.starred && <Star size={13} className="star-on" fill="currentColor" />}<span>{p.title}</span><ChevronDown size={14} /></button>
      : <button className="row-more" aria-label={`${p.title} のメニュー`} aria-haspopup="menu" aria-expanded={open}
        onClick={e => { e.stopPropagation(); toggleRow(e.currentTarget); }}><MoreHorizontal size={16} /></button>}
    {open && <div className={"menu chat-pop" + (p.variant === "row" ? " fixed" : " down")} style={p.variant === "row" ? fixed : undefined} role="menu" onClick={e => e.stopPropagation()}>
      <button className="menu-item" role="menuitem" onClick={run(p.onStar)}><Star size={15} />{p.starred ? "スターを外す" : "スターを付ける"}</button>
      <button className="menu-item" role="menuitem" onClick={run(p.onRename)}><Pencil size={15} />名前を変更</button>
      <button className="menu-item" role="menuitem" aria-expanded={moving} onClick={() => setMoving(v => !v)}><FolderOpen size={15} />プロジェクトに移動<ChevronDown size={13} className={"menu-tail" + (moving ? " open" : "")} /></button>
      {moving && <div className="style-list">
        <button className="menu-item" onClick={run(() => p.onMoveProject(undefined))}>プロジェクトなし{!p.projectId && <Check size={14} className="menu-check" />}</button>
        {p.projects.map(pr => <button key={pr.id} className="menu-item" onClick={run(() => p.onMoveProject(pr.id))}><span className="ellipsis">{pr.name}</span>{p.projectId === pr.id && <Check size={14} className="menu-check" />}</button>)}
      </div>}
      <button className="menu-item" role="menuitem" onClick={run(p.onExport)}><Download size={15} />JSON で書き出す</button>
      <div className="menu-sep" />
      <button className="menu-item danger" role="menuitem" onClick={run(p.onDelete)}><Trash2 size={15} />削除</button>
    </div>}
  </div>;
}
