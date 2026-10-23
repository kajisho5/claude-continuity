import { useMemo, useState } from "react";
import { ArrowLeft, Brain, FileText, FolderOpen, Pencil, Plus, Search, Star } from "lucide-react";
import type { Project } from "./ProjectModal";
import { AttachmentChip } from "./MessageItem";
import { relativeTime } from "../lib/time";

type ChatRow = { id: string; title: string; projectId?: string; updatedAt?: string; starred?: boolean; preview: string };
const latest = (rows: ChatRow[]) => rows.reduce<string | undefined>((max, r) => r.updatedAt && (!max || r.updatedAt > max) ? r.updatedAt : max, undefined);

/** Grid of projects, like the "Projects" page of the Claude apps. */
export function ProjectsPage({ projects, chats, now, onOpen, onCreate }: { projects: Project[]; chats: ChatRow[]; now: number; onOpen: (id: string) => void; onCreate: () => void }) {
  const [query, setQuery] = useState("");
  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.instructions.toLowerCase().includes(q))
      .map(p => { const rows = chats.filter(c => c.projectId === p.id); return { project: p, count: rows.length, updatedAt: latest(rows) }; })
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }, [projects, chats, query]);
  return <section className="chats-page projects-page">
    <div className="chats-head"><h1>プロジェクト</h1><button className="btn-primary" onClick={onCreate}><Plus size={15} />新しいプロジェクト</button></div>
    {projects.length > 0 && <label className="chats-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="プロジェクトを検索…" aria-label="プロジェクトを検索" /></label>}
    {projects.length === 0
      ? <div className="projects-empty">
        <FolderOpen size={28} />
        <b>プロジェクトで会話をまとめる</b>
        <p>指示とナレッジ（PDF やテキスト）を登録しておくと、そのプロジェクトの会話すべてに自動で付きます。ナレッジはキャッシュされるので、繰り返し送ってもコストを抑えられます。</p>
        <button className="btn-primary" onClick={onCreate}><Plus size={15} />最初のプロジェクトを作成</button>
      </div>
      : <div className="project-grid">
        {cards.map(({ project: p, count, updatedAt }) => <button key={p.id} className="project-card" onClick={() => onOpen(p.id)}>
          <b>{p.name}</b>
          <span className="project-desc">{p.instructions.trim() || "指示はまだありません"}</span>
          <small>{[`会話 ${count} 件`, p.knowledge.length ? `ナレッジ ${p.knowledge.length} 件` : "", updatedAt ? `更新 ${relativeTime(updatedAt, now)}` : ""].filter(Boolean).join(" · ")}</small>
        </button>)}
      </div>}
    {projects.length > 0 && cards.length === 0 && <p className="hint">一致するプロジェクトはありません。</p>}
  </section>;
}

/** One project: start a chat, see its chats, and its instructions / knowledge on the side. */
export function ProjectPage({ project, chats, now, onBack, onEdit, onStart, onOpenChat }: {
  project: Project; chats: ChatRow[]; now: number;
  onBack: () => void; onEdit: () => void; onStart: () => void; onOpenChat: (id: string) => void;
}) {
  const rows = chats.filter(c => c.projectId === project.id).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return <section className="project-page">
    <div className="project-main">
      <button className="link-btn back" onClick={onBack}><ArrowLeft size={14} />すべてのプロジェクト</button>
      <div className="project-title"><h1>{project.name}</h1><button className="ghost-btn tip" data-tip="プロジェクトを編集" aria-label="プロジェクトを編集" onClick={onEdit}><Pencil size={16} /></button></div>
      <button className="project-start" onClick={onStart}><span>このプロジェクトで会話を始める…</span><span className="send-btn" aria-hidden><Plus size={16} strokeWidth={2.4} /></span></button>
      <ul className="chats-list">
        {rows.map(c => <li key={c.id}><button onClick={() => onOpenChat(c.id)}>
          <span className="chats-title">{c.starred && <Star size={13} className="star-on" fill="currentColor" />}{c.title}</span>
          {c.preview && <span className="chats-preview">{c.preview}</span>}
          {c.updatedAt && <small>最終メッセージ {relativeTime(c.updatedAt, now)}</small>}
        </button></li>)}
      </ul>
      {rows.length === 0 && <p className="hint">まだ会話はありません。上の入力欄から始めましょう。</p>}
    </div>
    <div className="project-side">
      <div className="side-card">
        <div className="side-card-head"><b>指示</b><button className="link" onClick={onEdit}>編集</button></div>
        <p className={project.instructions.trim() ? "" : "dim"}>{project.instructions.trim() || "このプロジェクトでの回答の仕方を指示できます。"}</p>
      </div>
      <div className="side-card">
        <div className="side-card-head"><b>ナレッジ</b><button className="link" onClick={onEdit}>追加</button></div>
        {project.knowledge.length
          ? <div className="knowledge-list">{project.knowledge.map(k => <AttachmentChip key={k.id} attachment={k} />)}</div>
          : <p className="dim"><FileText size={13} /> PDF やテキストを追加すると、毎回の会話に自動で添付されます。</p>}
      </div>
      <div className="side-card">
        <div className="side-card-head"><b><Brain size={14} /> メモリ</b><span className={"pill-state " + (project.memory ? "on" : "")}>{project.memory ? "オン" : "オフ"}</span></div>
        <p className="dim">{project.memory ? "このプロジェクトの会話では、Claude が覚えておいた内容を使います。" : "オンにすると、会話をまたいで覚えておけます。"}</p>
      </div>
    </div>
  </section>;
}
