import { useMemo, useState } from "react";
import { ArrowLeft, Brain, FileText, FolderOpen, Pencil, Plus, Search, Star } from "lucide-react";
import type { Project } from "./ProjectModal";
import { AttachmentChip } from "./MessageItem";
import { relativeTime } from "../lib/time";
import { useT } from "../i18n";
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
  const t = useT();
  const s = t.pages.projects;
  const [query, setQuery] = useState("");
  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.instructions.toLowerCase().includes(q))
      .map(p => { const rows = chats.filter(c => c.projectId === p.id); return { project: p, count: rows.length, updatedAt: latest(rows) }; })
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }, [projects, chats, query]);
  return <section className={PAGE + " projects-page"}>
    <div className={PAGE_HEAD}><h1 className={PAGE_TITLE}>{s.title}</h1><button className="btn-primary" onClick={onCreate}><Plus size={15} />{s.newProject}</button></div>
    {projects.length > 0 && <label className={SEARCH}><Search size={16} /><input className={SEARCH_INPUT} value={query} onChange={e => setQuery(e.target.value)} placeholder={s.searchPlaceholder} aria-label={s.search} /></label>}
    {projects.length === 0
      ? <div className={EMPTY}>
        <FolderOpen size={28} />
        <b className={EMPTY_TITLE}>{s.emptyTitle}</b>
        <p className={EMPTY_TEXT}>{s.emptyText}</p>
        <button className="btn-primary" onClick={onCreate}><Plus size={15} />{s.createFirst}</button>
      </div>
      : <div className={GRID}>
        {cards.map(({ project: p, count, updatedAt }) => <button key={p.id} className={CARD} onClick={() => onOpen(p.id)}>
          <b className={CARD_TITLE + " font-serif text-[15px]"}>{p.name}</b>
          <span className={CARD_DESC}>{p.instructions.trim() || s.noInstructions}</span>
          <small className={CARD_META}>{[s.chatCount(count), p.knowledge.length ? s.knowledgeCount(p.knowledge.length) : "", updatedAt ? s.updated(relativeTime(updatedAt, now)) : ""].filter(Boolean).join(" · ")}</small>
        </button>)}
      </div>}
    {projects.length > 0 && cards.length === 0 && <p className="hint mb-0">{s.noMatches}</p>}
  </section>;
}

/** One project: start a chat, see its chats, and its instructions / knowledge on the side. */
export function ProjectPage({ project, chats, now, onBack, onEdit, onStart, onOpenChat }: {
  project: Project; chats: ChatRow[]; now: number;
  onBack: () => void; onEdit: () => void; onStart: () => void; onOpenChat: (id: string) => void;
}) {
  const t = useT();
  const s = t.pages.project;
  const rows = chats.filter(c => c.projectId === project.id).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return <section className="project-page flex flex-1 animate-[fadeUp_.25s_var(--ease)_both] gap-[32px] overflow-auto px-[max(24px,calc((100%_-_1040px)/2))] pt-[28px] pb-[40px] [@media(max-width:1000px)]:flex-col">
    <div className="project-main min-w-0 flex-1">
      <button className="link-btn back -ml-[8px] inline-flex items-center gap-[6px] self-start rounded-[6px] border-0 bg-transparent px-[8px] py-[4px] text-[12px] text-subtle hover:text-ink-3" onClick={onBack}><ArrowLeft size={14} />{s.allProjects}</button>
      <div className="project-title mt-[10px] mx-0 mb-[18px] flex items-center gap-[6px]"><h1 className={PAGE_TITLE}>{project.name}</h1><button className="ghost-btn tip" data-tip={s.edit} aria-label={s.edit} onClick={onEdit}><Pencil size={16} /></button></div>
      <button className="project-start mb-[22px] flex min-h-[96px] w-full items-start justify-between rounded-[20px] border border-line-strong bg-surface-2 pt-[16px] pr-[14px] pb-[14px] pl-[18px] text-left text-[15px] text-subtle shadow-[0_1px_2px_#0003,0_8px_28px_#0002] hover:border-line-input" onClick={onStart}><span>{s.start}</span><span className="send-btn pointer-events-none ml-[4px] inline-grid size-[32px] place-items-center self-end rounded-[10px] border-0 bg-accent p-0 text-on-accent shadow-[0_1px_2px_#0004]" aria-hidden><Plus size={16} strokeWidth={2.4} /></span></button>
      <ul className={LIST}>
        {rows.map(c => <li key={c.id} className={ROW}><button className={ROW_BTN + " bg-transparent hover:bg-surface"} onClick={() => onOpenChat(c.id)}>
          <span className={ROW_TITLE}>{c.starred && <Star size={13} className={STAR} fill="currentColor" />}{c.title}</span>
          {c.preview && <span className={ROW_PREVIEW}>{c.preview}</span>}
          {c.updatedAt && <small className={ROW_META}>{s.lastMessage} {relativeTime(c.updatedAt, now)}</small>}
        </button></li>)}
      </ul>
      {rows.length === 0 && <p className="hint mb-0">{s.noChats}</p>}
    </div>
    <div className="project-side flex w-[300px] shrink-0 flex-col gap-[12px] pt-[44px] [@media(max-width:1000px)]:w-auto [@media(max-width:1000px)]:pt-0">
      <div className={SIDE_CARD}>
        <div className={SIDE_HEAD}><b className={SIDE_HEAD_TITLE}>{s.instructions}</b><button className={SIDE_LINK} onClick={onEdit}>{t.common.edit}</button></div>
        <p className={SIDE_TEXT + (project.instructions.trim() ? " text-ink-4" : " dim text-subtle")}>{project.instructions.trim() || s.instructionsPlaceholder}</p>
      </div>
      <div className={SIDE_CARD}>
        <div className={SIDE_HEAD}><b className={SIDE_HEAD_TITLE}>{s.knowledge}</b><button className={SIDE_LINK} onClick={onEdit}>{t.common.add}</button></div>
        {project.knowledge.length
          ? <div className="knowledge-list flex flex-wrap items-center gap-[6px]">{project.knowledge.map(k => <AttachmentChip key={k.id} attachment={k} />)}</div>
          : <p className={SIDE_TEXT + " dim text-subtle"}><FileText size={13} /> {s.knowledgeEmpty}</p>}
      </div>
      <div className={SIDE_CARD}>
        <div className={SIDE_HEAD}><b className={SIDE_HEAD_TITLE}><Brain size={14} /> {s.memory}</b><span className={"pill-state rounded-[10px] px-[9px] py-[2px] text-[11px] " + (project.memory ? "on bg-ok/18 text-ok" : "bg-line text-muted")}>{project.memory ? t.common.on : t.common.off}</span></div>
        <p className={SIDE_TEXT + " dim text-subtle"}>{project.memory ? s.memoryOn : s.memoryOff}</p>
      </div>
    </div>
  </section>;
}
