import { useMemo, useState } from "react";
import { CheckSquare, Plus, Search, Square, Star, Trash2 } from "lucide-react";
import { relativeTime } from "../lib/time";

type Row = { id: string; title: string; updatedAt?: string; starred?: boolean; projectName?: string; preview: string };

/** Full chat history with search, like the "Chats" page of the Claude apps. */
export default function ChatsPage({ chats, onOpen, onNew, onDelete, now }: { chats: Row[]; onOpen: (id: string) => void; onNew: () => void; onDelete: (ids: string[]) => void; now: number }) {
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? chats.filter(c => c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q)) : chats;
    return [...filtered].sort((a, b) => (Date.parse(b.updatedAt ?? "") || 0) - (Date.parse(a.updatedAt ?? "") || 0));
  }, [chats, query]);
  return <section className="chats-page">
    <div className="chats-head"><h1>チャット履歴</h1><button className="btn-primary" onClick={onNew}><Plus size={15} />新しい会話</button></div>
    <label className="chats-search"><Search size={16} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="会話を検索…" aria-label="会話を検索" /></label>
    <div className="chats-toolbar">
      <p className="chats-count">{selecting ? `${selected.size} 件を選択中` : query ? `「${query}」に一致する会話 ${rows.length} 件` : `${rows.length} 件の会話`}</p>
      {selecting
        ? <>
          <button className="btn-text" onClick={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))}>{selected.size === rows.length && rows.length ? "選択を解除" : "すべて選択"}</button>
          <button className="btn-danger small" disabled={!selected.size} onClick={() => { onDelete([...selected]); setSelected(new Set()); setSelecting(false); }}><Trash2 size={13} />{selected.size} 件を削除</button>
          <button className="btn-secondary small" onClick={() => { setSelecting(false); setSelected(new Set()); }}>キャンセル</button>
        </>
        : rows.length > 0 && <button className="btn-secondary small" onClick={() => setSelecting(true)}><CheckSquare size={13} />選択</button>}
    </div>
    <ul className="chats-list">
      {rows.map(c => <li key={c.id} className={selecting && selected.has(c.id) ? "selected" : ""}><button onClick={() => selecting ? toggle(c.id) : onOpen(c.id)} aria-pressed={selecting ? selected.has(c.id) : undefined}>
        <span className="chats-title">{selecting && (selected.has(c.id) ? <CheckSquare size={15} className="check on" /> : <Square size={15} className="check" />)}{c.starred && <Star size={13} className="star-on" fill="currentColor" />}{c.title}</span>
        {c.preview && <span className="chats-preview">{c.preview}</span>}
        <small>{[c.projectName, relativeTime(c.updatedAt, now) && `最終メッセージ ${relativeTime(c.updatedAt, now)}`].filter(Boolean).join(" · ")}</small>
      </button></li>)}
    </ul>
    {rows.length === 0 && <p className="hint">一致する会話はありません。</p>}
  </section>;
}
