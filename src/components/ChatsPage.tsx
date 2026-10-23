import { useMemo, useState } from "react";
import { CheckSquare, Plus, Search, Square, Star, Trash2 } from "lucide-react";
import { relativeTime } from "../lib/time";
import { useT } from "../i18n";

/** `.chats-page` (also the artifacts and projects pages). */
export const PAGE = "chats-page flex-1 animate-[fadeUp_.25s_var(--ease)_both] overflow-x-hidden overflow-y-auto px-[max(24px,calc((100%_-_760px)/2))] pt-[36px] pb-[40px]";
export const PAGE_HEAD = "chats-head flex items-center justify-between gap-[12px]";
export const PAGE_TITLE = "m-0 font-serif text-[30px] leading-[1.2] font-normal text-ink";
export const SEARCH = "chats-search mt-[22px] flex items-center gap-[10px] rounded-[12px] border border-line-strong bg-inset px-[14px] text-subtle focus-within:border-accent";
export const SEARCH_INPUT = "flex-1 border-0 bg-transparent px-0 py-[12px] font-sans text-[14px] text-ink outline-none focus-visible:outline-none";
/** `.chats-list` and its rows. */
export const LIST = "chats-list m-0 list-none border-t border-line p-0";
export const ROW = "border-b border-line";
export const ROW_BTN = "my-[2px] flex w-full min-w-0 flex-col gap-[4px] overflow-hidden rounded-[10px] border-0 px-[12px] py-[14px] text-left";
export const ROW_TITLE = "chats-title flex items-center gap-[6px] text-[14px] font-medium text-ink";
export const ROW_PREVIEW = "chats-preview block max-w-full truncate text-[12.5px] text-muted";
export const ROW_META = "text-[11.5px] text-subtle";
export const STAR = "star-on text-warn";

type Row = { id: string; title: string; updatedAt?: string; starred?: boolean; projectName?: string; preview: string };

/** Full chat history with search, like the "Chats" page of the Claude apps. */
export default function ChatsPage({ chats, onOpen, onNew, onDelete, now }: { chats: Row[]; onOpen: (id: string) => void; onNew: () => void; onDelete: (ids: string[]) => void; now: number }) {
  const t = useT();
  const s = t.pages.chats;
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? chats.filter(c => c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q)) : chats;
    return [...filtered].sort((a, b) => (Date.parse(b.updatedAt ?? "") || 0) - (Date.parse(a.updatedAt ?? "") || 0));
  }, [chats, query]);
  return <section className={PAGE}>
    <div className={PAGE_HEAD}><h1 className={PAGE_TITLE}>{s.title}</h1><button className="btn-primary" onClick={onNew}><Plus size={15} />{s.newChat}</button></div>
    <label className={SEARCH}><Search size={16} /><input className={SEARCH_INPUT} autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={s.searchPlaceholder} aria-label={s.search} /></label>
    <div className="chats-toolbar mt-[16px] mx-[2px] mb-[6px] flex items-center gap-[8px]">
      <p className="chats-count m-0 flex-1 text-[12.5px] text-muted">{selecting ? s.selectedCount(selected.size) : query ? s.matchCount(query, rows.length) : s.totalCount(rows.length)}</p>
      {selecting
        ? <>
          <button className="btn-text" onClick={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))}>{selected.size === rows.length && rows.length ? s.deselectAll : s.selectAll}</button>
          <button className="btn-danger small" disabled={!selected.size} onClick={() => { const shown = new Set(rows.map(r => r.id)); onDelete([...selected].filter(id => shown.has(id))); setSelected(new Set()); setSelecting(false); }}><Trash2 size={13} />{s.deleteSelected(selected.size)}</button>
          <button className="btn-secondary small" onClick={() => { setSelecting(false); setSelected(new Set()); }}>{t.common.cancel}</button>
        </>
        : rows.length > 0 && <button className="btn-secondary small" onClick={() => setSelecting(true)}><CheckSquare size={13} />{s.select}</button>}
    </div>
    <ul className={LIST}>
      {rows.map(c => <li key={c.id} className={(selecting && selected.has(c.id) ? "selected " : "") + ROW}><button className={ROW_BTN + (selecting && selected.has(c.id) ? " bg-accent/10" : " bg-transparent hover:bg-surface")} onClick={() => selecting ? toggle(c.id) : onOpen(c.id)} aria-pressed={selecting ? selected.has(c.id) : undefined}>
        <span className={ROW_TITLE}>{selecting && (selected.has(c.id) ? <CheckSquare size={15} className="check on shrink-0 text-accent" /> : <Square size={15} className="check shrink-0 text-subtle" />)}{c.starred && <Star size={13} className={STAR} fill="currentColor" />}{c.title}</span>
        {c.preview && <span className={ROW_PREVIEW}>{c.preview}</span>}
        <small className={ROW_META}>{[c.projectName, relativeTime(c.updatedAt, now) && s.lastMessage(relativeTime(c.updatedAt, now))].filter(Boolean).join(" · ")}</small>
      </button></li>)}
    </ul>
    {rows.length === 0 && <p className="hint mb-0">{s.noMatches}</p>}
  </section>;
}
