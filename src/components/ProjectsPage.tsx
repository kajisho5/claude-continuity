import { useMemo, useState } from "react";
import { ArrowLeft, Brain, FileText, FolderOpen, Pencil, Plus, Search, Star } from "lucide-react";
import type { Project } from "./ProjectModal";
import { AttachmentChip } from "./MessageItem";
import { relativeTime } from "../lib/time";
import { LIST, PAGE, PAGE_HEAD, PAGE_TITLE, ROW, ROW_BTN, ROW_META, ROW_PREVIEW, ROW_TITLE, SEARCH, SEARCH_INPUT, STAR } from "./ChatsPage";

/** `.project-grid`, `.project-card` (+ `b`, `small`), `.project-desc`, `.projects-empty`: shared with the artifacts page. */
export const GRID = "project-grid mt-[18px] grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[14px]";
export const CARD = "project-card flex min-h-[150px] flex-col items-start gap-[8px] rounded-[14px] border border-line-strong bg-surface p-[18px] text-left hover:border-line-input hover:shadow-[0_8px_24px_var(--shadow)] hover:[transform:translateY(-1px)]";
/** Callers add font family and size (projects: serif 15px; artifacts: sans 14px). */
export const CARD_TITLE = "leading-[normal] font-semibold text-ink";
export const CARD_DESC = "project-desc line-clamp-3 flex-1 text-[12.5px] leading-[1.7] text-muted";
export const CARD_META = "text-[11px] text-subtle";
export const EMPTY = "projects-empty mt-[28px] flex flex-col items-center gap-[12px] rounded-[16px] border border-dashed border-line-strong px-[24px] py-[40px] text-center text-muted";
export const EMPTY_TITLE = "font-serif leading-[normal] text-[17px] font-semibold text-ink";
export const EMPTY_TEXT = "m-0 max-w-[460px] text-[13px] leading-[1.8]";
const SIDE_CARD = "side-card rounded-[14px] border border-line-strong bg-surface px-[16px] py-[14px]";
const SIDE_HEAD = "side-card-head mb-[8px] flex items-center justify-between";
const SIDE_HEAD_TITLE = "inline-flex items-center gap-[6px] text-[13px] text-ink-2";
const SIDE_LINK = "link text-[12px] no-underline";
const SIDE_TEXT = "m-0 line-clamp-8 text-[12.5px] leading-[1.7] whitespace-pre-wrap";

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
  return <section className={PAGE + " projects-page"}>
    <div className={PAGE_HEAD}><h1 className={PAGE_TITLE}>プロジェクト</h1><button className="btn-primary" onClick={onCreate}><Plus size={15} />新しいプロジェクト</button></div>
    {projects.length > 0 && <label className={SEARCH}><Search size={16} /><input className={SEARCH_INPUT} value={query} onChange={e => setQuery(e.target.value)} placeholder="プロジェクトを検索…" aria-label="プロジェクトを検索" /></label>}
    {projects.length === 0
      ? <div className={EMPTY}>
        <FolderOpen size={28} />
        <b className={EMPTY_TITLE}>プロジェクトで会話をまとめる</b>
        <p className={EMPTY_TEXT}>指示とナレッジ（PDF やテキスト）を登録しておくと、そのプロジェクトの会話すべてに自動で付きます。ナレッジはキャッシュされるので、繰り返し送ってもコストを抑えられます。</p>
        <button className="btn-primary" onClick={onCreate}><Plus size={15} />最初のプロジェクトを作成</button>
      </div>
      : <div className={GRID}>
        {cards.map(({ project: p, count, updatedAt }) => <button key={p.id} className={CARD} onClick={() => onOpen(p.id)}>
          <b className={CARD_TITLE + " font-serif text-[15px]"}>{p.name}</b>
          <span className={CARD_DESC}>{p.instructions.trim() || "指示はまだありません"}</span>
          <small className={CARD_META}>{[`会話 ${count} 件`, p.knowledge.length ? `ナレッジ ${p.knowledge.length} 件` : "", updatedAt ? `更新 ${relativeTime(updatedAt, now)}` : ""].filter(Boolean).join(" · ")}</small>
        </button>)}
      </div>}
    {projects.length > 0 && cards.length === 0 && <p className="hint mb-0">一致するプロジェクトはありません。</p>}
  </section>;
}

/** One project: start a chat, see its chats, and its instructions / knowledge on the side. */
export function ProjectPage({ project, chats, now, onBack, onEdit, onStart, onOpenChat }: {
  project: Project; chats: ChatRow[]; now: number;
  onBack: () => void; onEdit: () => void; onStart: () => void; onOpenChat: (id: string) => void;
}) {
  const rows = chats.filter(c => c.projectId === project.id).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return <section className="project-page flex flex-1 animate-[fadeUp_.25s_var(--ease)_both] gap-[32px] overflow-auto px-[max(24px,calc((100%_-_1040px)/2))] pt-[28px] pb-[40px] [@media(max-width:1000px)]:flex-col">
    <div className="project-main min-w-0 flex-1">
      <button className="link-btn back -ml-[8px] inline-flex items-center gap-[6px] self-start rounded-[6px] border-0 bg-transparent px-[8px] py-[4px] text-[12px] text-subtle hover:text-ink-3" onClick={onBack}><ArrowLeft size={14} />すべてのプロジェクト</button>
      <div className="project-title mt-[10px] mx-0 mb-[18px] flex items-center gap-[6px]"><h1 className={PAGE_TITLE}>{project.name}</h1><button className="ghost-btn tip" data-tip="プロジェクトを編集" aria-label="プロジェクトを編集" onClick={onEdit}><Pencil size={16} /></button></div>
      <button className="project-start mb-[22px] flex min-h-[96px] w-full items-start justify-between rounded-[20px] border border-line-strong bg-surface-2 pt-[16px] pr-[14px] pb-[14px] pl-[18px] text-left text-[15px] text-subtle shadow-[0_1px_2px_#0003,0_8px_28px_#0002] hover:border-line-input" onClick={onStart}><span>このプロジェクトで会話を始める…</span><span className="send-btn pointer-events-none ml-[4px] inline-grid size-[32px] place-items-center self-end rounded-[10px] border-0 bg-accent p-0 text-on-accent shadow-[0_1px_2px_#0004]" aria-hidden><Plus size={16} strokeWidth={2.4} /></span></button>
      <ul className={LIST}>
        {rows.map(c => <li key={c.id} className={ROW}><button className={ROW_BTN + " bg-transparent hover:bg-surface"} onClick={() => onOpenChat(c.id)}>
          <span className={ROW_TITLE}>{c.starred && <Star size={13} className={STAR} fill="currentColor" />}{c.title}</span>
          {c.preview && <span className={ROW_PREVIEW}>{c.preview}</span>}
          {c.updatedAt && <small className={ROW_META}>最終メッセージ {relativeTime(c.updatedAt, now)}</small>}
        </button></li>)}
      </ul>
      {rows.length === 0 && <p className="hint mb-0">まだ会話はありません。上の入力欄から始めましょう。</p>}
    </div>
    <div className="project-side flex w-[300px] shrink-0 flex-col gap-[12px] pt-[44px] [@media(max-width:1000px)]:w-auto [@media(max-width:1000px)]:pt-0">
      <div className={SIDE_CARD}>
        <div className={SIDE_HEAD}><b className={SIDE_HEAD_TITLE}>指示</b><button className={SIDE_LINK} onClick={onEdit}>編集</button></div>
        <p className={SIDE_TEXT + (project.instructions.trim() ? " text-ink-4" : " dim text-subtle")}>{project.instructions.trim() || "このプロジェクトでの回答の仕方を指示できます。"}</p>
      </div>
      <div className={SIDE_CARD}>
        <div className={SIDE_HEAD}><b className={SIDE_HEAD_TITLE}>ナレッジ</b><button className={SIDE_LINK} onClick={onEdit}>追加</button></div>
        {project.knowledge.length
          ? <div className="knowledge-list flex flex-wrap items-center gap-[6px]">{project.knowledge.map(k => <AttachmentChip key={k.id} attachment={k} />)}</div>
          : <p className={SIDE_TEXT + " dim text-subtle"}><FileText size={13} /> PDF やテキストを追加すると、毎回の会話に自動で添付されます。</p>}
      </div>
      <div className={SIDE_CARD}>
        <div className={SIDE_HEAD}><b className={SIDE_HEAD_TITLE}><Brain size={14} /> メモリ</b><span className={"pill-state rounded-[10px] px-[9px] py-[2px] text-[11px] " + (project.memory ? "on bg-ok/18 text-ok" : "bg-line text-muted")}>{project.memory ? "オン" : "オフ"}</span></div>
        <p className={SIDE_TEXT + " dim text-subtle"}>{project.memory ? "このプロジェクトの会話では、Claude が覚えておいた内容を使います。" : "オンにすると、会話をまたいで覚えておけます。"}</p>
      </div>
    </div>
  </section>;
}
