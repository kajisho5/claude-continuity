import { useState } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { AttachmentChip, formatBytes } from "./MessageItem";

type Attachment = { id: string; name: string; mediaType: string; size: number; kind: "image" | "pdf" | "text" | "file" };
export type Project = { id: string; name: string; instructions: string; knowledge: Attachment[]; memory: boolean };

type Props = { project: Project; isNew: boolean; onSave: (project: Project) => Promise<void>; onDelete: () => void; onClose: () => void };

function knowledgeHint(knowledge: Attachment[]): string {
  const bytes = knowledge.reduce((sum, k) => sum + k.size, 0);
  return knowledge.length ? `${knowledge.length} 件 · ${formatBytes(bytes)} · 毎回の会話に添付（自動キャッシュで再送コストを抑えます）` : "PDF やテキストを追加すると、毎回の会話に自動で添付されます";
}

export default function ProjectModal({ project, isNew, onSave, onDelete, onClose }: Props) {
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
    try { await onSave({ ...draft, name: draft.name.trim() || "プロジェクト" }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }
  return <div className="overlay" onClick={onClose}><div className="modal wide w-[min(560px,100%)]" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="project-title">
    <button className="close absolute top-[12px] right-[15px] border-0 bg-transparent text-[22px] text-muted" onClick={onClose} aria-label="閉じる">×</button>
    <h2 id="project-title">{isNew ? "新しいプロジェクト" : "プロジェクト設定"}</h2>
    <label className="field"><span>名前</span><input className="text-input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="例: Q3 レポート" /></label>
    <label className="field"><span>カスタム指示</span>
      <textarea className="text-input tall" value={draft.instructions} onChange={e => setDraft({ ...draft, instructions: e.target.value })}
        placeholder="例: あなたは小売企業の経営企画担当のアシスタントです。数字は出典と比較対象を明記し、結論を先に書いてください。" /></label>
    <div className="field"><span>ナレッジ <small className="muted inline ml-[6px] text-[9.5px] font-normal">{knowledgeHint(draft.knowledge)}</small></span>
      <div className="knowledge-list flex flex-wrap items-center gap-[6px]">
        {draft.knowledge.map(k => <AttachmentChip key={k.id} attachment={k} onRemove={() => setDraft(d => ({ ...d, knowledge: d.knowledge.filter(x => x.id !== k.id) }))} />)}
        <button className="btn-secondary small" onClick={() => void addFiles()}><Paperclip size={13} /> ファイルを追加</button>
      </div>
    </div>
    <label className="toggle-row"><span><b>このプロジェクトでメモリを使う</b><small>覚えた内容はこの端末の memories フォルダに保存され、API設定から確認・削除できます</small></span>
      <input type="checkbox" className="switch" checked={draft.memory} onChange={e => setDraft({ ...draft, memory: e.target.checked })} /></label>
    {error && <p className="key-check error m-[8px_0_0] text-[11px] text-danger">{error}</p>}
    <div className="actions">
      {!isNew && <button className="btn-text danger inline-flex items-center gap-[5px] text-danger" onClick={() => { if (window.confirm("このプロジェクトを削除しますか？（会話は残ります）")) { onDelete(); onClose(); } }}><Trash2 size={13} /> 削除</button>}
      <span className="spacer flex-1" />
      <button className="btn-secondary" onClick={onClose}>キャンセル</button>
      <button className="btn-primary" disabled={saving} onClick={() => void save()}>保存</button>
    </div>
  </div></div>;
}
