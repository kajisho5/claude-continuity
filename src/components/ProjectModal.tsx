import { useState } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { AttachmentChip, formatBytes } from "./MessageItem";
import { useT, type Messages } from "../i18n";

type Attachment = { id: string; name: string; mediaType: string; size: number; kind: "image" | "pdf" | "text" | "file" };
export type Project = { id: string; name: string; instructions: string; knowledge: Attachment[]; memory: boolean };

type Props = { project: Project; isNew: boolean; onSave: (project: Project) => Promise<void>; onDelete: () => void; onClose: () => void };

function knowledgeHint(knowledge: Attachment[], t: Messages): string {
  const bytes = knowledge.reduce((sum, k) => sum + k.size, 0);
  return knowledge.length ? t.pages.projectModal.knowledgeSummary(knowledge.length, formatBytes(bytes)) : t.pages.projectModal.knowledgeEmpty;
}

export default function ProjectModal({ project, isNew, onSave, onDelete, onClose }: Props) {
  const t = useT();
  const s = t.pages.projectModal;
  const [draft, setDraft] = useState(project);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function addFiles() {
    const result = await window.continuity.pickAttachments();
    if (result.errors.length) setError(result.errors.join(" / "));
    if (result.added.length) setDraft(d => ({ ...d, knowledge: [...d.knowledge, ...result.added] }));
  }
  async function save() {
    setSaving(true);
    try { await onSave({ ...draft, name: draft.name.trim() || s.defaultName }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }
  return <div className="overlay" onClick={onClose}><div className="modal wide w-[min(560px,100%)]" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="project-title">
    <button className="close absolute top-[12px] right-[15px] border-0 bg-transparent text-[22px] text-muted" onClick={onClose} aria-label={t.common.close}>×</button>
    <h2 id="project-title">{isNew ? s.newTitle : s.editTitle}</h2>
    <label className="field"><span>{s.name}</span><input className="text-input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder={s.namePlaceholder} /></label>
    <label className="field"><span>{s.instructions}</span>
      <textarea className="text-input tall" value={draft.instructions} onChange={e => setDraft({ ...draft, instructions: e.target.value })}
        placeholder={s.instructionsPlaceholder} /></label>
    <div className="field"><span>{s.knowledge} <small className="muted inline ml-[6px] text-[9.5px] font-normal">{knowledgeHint(draft.knowledge, t)}</small></span>
      <div className="knowledge-list flex flex-wrap items-center gap-[6px]">
        {draft.knowledge.map(k => <AttachmentChip key={k.id} attachment={k} onRemove={() => setDraft(d => ({ ...d, knowledge: d.knowledge.filter(x => x.id !== k.id) }))} />)}
        <button className="btn-secondary small" onClick={() => void addFiles()}><Paperclip size={13} /> {s.addFiles}</button>
      </div>
    </div>
    <label className="toggle-row"><span><b>{s.useMemory}</b><small>{s.memoryHint}</small></span>
      <input type="checkbox" className="switch" checked={draft.memory} onChange={e => setDraft({ ...draft, memory: e.target.checked })} /></label>
    {error && <p className="key-check error m-[8px_0_0] text-[11px] text-danger">{error}</p>}
    <div className="actions">
      {!isNew && <button className="btn-text danger inline-flex items-center gap-[5px] text-danger" onClick={() => { if (window.confirm(s.confirmDelete)) { onDelete(); onClose(); } }}><Trash2 size={13} /> {t.common.delete}</button>}
      <span className="spacer flex-1" />
      <button className="btn-secondary" onClick={onClose}>{t.common.cancel}</button>
      <button className="btn-primary" disabled={saving} onClick={() => void save()}>{t.common.save}</button>
    </div>
  </div></div>;
}
