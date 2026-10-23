import { useMemo, useState } from "react";
import { Plus, Search, Star } from "lucide-react";
import { relativeTime } from "../lib/time";

type Row = { id: string; title: string; updatedAt?: string; starred?: boolean; projectName?: string; preview: string };

/** Full chat history with search, like the "Chats" page of the Claude apps. */
export default function ChatsPage({ chats, onOpen, onNew, now }: { chats: Row[]; onOpen: (id: string) => void; onNew: () => void; now: number }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? chats.filter(c => c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q)) : chats;
    return [...filtered].sort((a, b) => (Date.parse(b.updatedAt ?? "") || 0) - (Date.parse(a.updatedAt ?? "") || 0));
  }, [chats, query]);
  return <section className="chats-page">
    <div className="chats-head"><h1>チャット履歴</h1><button className="btn-primary" onClick={onNew}><Plus size={15} />新しい会話</button></div>
    <label className="chats-search"><Search size={16} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="会話を検索…" aria-label="会話を検索" /></label>
    <p className="chats-count">{query ? `「${query}」に一致する会話 ${rows.length} 件` : `${rows.length} 件の会話`}</p>
    <ul className="chats-list">
      {rows.map(c => <li key={c.id}><button onClick={() => onOpen(c.id)}>
        <span className="chats-title">{c.starred && <Star size={13} className="star-on" fill="currentColor" />}{c.title}</span>
        {c.preview && <span className="chats-preview">{c.preview}</span>}
        <small>{[c.projectName, relativeTime(c.updatedAt, now) && `最終メッセージ ${relativeTime(c.updatedAt, now)}`].filter(Boolean).join(" · ")}</small>
      </button></li>)}
    </ul>
    {rows.length === 0 && <p className="hint">一致する会話はありません。</p>}
  </section>;
}
