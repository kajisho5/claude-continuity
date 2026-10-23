import { useMemo, useState } from "react";
import { Code2, FileText, Image as ImageIcon, Search, Workflow } from "lucide-react";
import { KIND_LABEL, type ArtifactRequest } from "../lib/artifacts";
import { relativeTime } from "../lib/time";

export type ArtifactEntry = { key: string; chatId: string; chatTitle: string; updatedAt?: string; latest: ArtifactRequest; versions: number };
const ICON = { html: Code2, svg: ImageIcon, markdown: FileText, mermaid: Workflow } as const;

/** Every artifact across saved chats (latest version of each), like the Claude apps' artifact list. */
export default function ArtifactsPage({ entries, now, onOpen }: { entries: ArtifactEntry[]; now: number; onOpen: (entry: ArtifactEntry) => void }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(e => !q || e.latest.title.toLowerCase().includes(q) || e.chatTitle.toLowerCase().includes(q))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }, [entries, query]);
  return <section className="chats-page artifacts-page">
    <div className="chats-head"><h1>アーティファクト</h1></div>
    <label className="chats-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="アーティファクトを検索…" aria-label="アーティファクトを検索" /></label>
    {entries.length === 0
      ? <div className="projects-empty"><Code2 size={28} /><b>まだアーティファクトはありません</b>
        <p>Claude が HTML・SVG・図（Mermaid）・長めの文書（Markdown）を書くと、ここにまとまります。会話の中ではカードとして表示され、クリックすると右側で開きます。</p></div>
      : <div className="project-grid">
        {shown.map(e => { const Icon = ICON[e.latest.language]; return <button key={e.chatId + e.key} className="project-card artifact-entry" onClick={() => onOpen(e)}>
          <span className="artifact-thumb"><Icon size={20} /></span>
          <b>{e.latest.title}</b>
          <span className="project-desc">{e.chatTitle}</span>
          <small>{[KIND_LABEL[e.latest.language], e.versions > 1 ? `${e.versions} バージョン` : "", e.updatedAt ? relativeTime(e.updatedAt, now) : ""].filter(Boolean).join(" · ")}</small>
        </button>; })}
      </div>}
  </section>;
}
