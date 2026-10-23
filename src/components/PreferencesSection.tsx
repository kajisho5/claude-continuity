import { useEffect, useState } from "react";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { formatBytes } from "./MessageItem";
import { type CustomStyle, type Prefs } from "../lib/prefs";
import { useT } from "../i18n";

type Usage = Awaited<ReturnType<typeof window.continuity.styleFromSample>>["usage"];
const newId = () => Math.random().toString(36).slice(2, 10);

/** Several named custom styles, written by hand or generated from a writing sample. */
function StylesEditor({ prefs, onSave, model, onUsage }: { prefs: Prefs; onSave: (prefs: Prefs) => Promise<void>; model: string; onUsage: (usage: Usage) => void }) {
  const t = useT();
  const s = t.settings.styles;
  const [styles, setStyles] = useState<CustomStyle[]>(prefs.customStyles);
  const [sample, setSample] = useState("");
  const [sampleOpen, setSampleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const patch = (id: string, change: Partial<CustomStyle>) => setStyles(list => list.map(st => st.id === id ? { ...st, ...change } : st));
  async function save(next = styles) {
    const clean = next.filter(st => st.prompt.trim()).map(st => ({ ...st, name: st.name.trim() || s.defaultName }));
    await onSave({ ...prefs, customStyles: clean });
    setStyles(clean); setMessage(s.saved);
  }
  async function fromSample() {
    setBusy(true); setMessage("");
    try {
      const result = await window.continuity.styleFromSample({ sample, model });
      onUsage(result.usage);
      setStyles(list => [...list, { id: newId(), name: s.fromSampleName, prompt: result.prompt }]);
      setSample(""); setSampleOpen(false); setMessage(s.generated);
    } catch (e) { setMessage((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")); }
    finally { setBusy(false); }
  }
  return <>
    <h3 className="m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">{s.heading}</h3>
    <p className="muted">{s.intro}</p>
    <div className="style-editor-list mt-[10px] flex flex-col gap-[10px]">
      {styles.map(st => <div key={st.id} className="style-editor flex flex-col gap-[6px] rounded-[10px] border border-line bg-inset p-[10px]">
        <div className="style-editor-head flex items-center gap-[6px]"><input className="text-input px-[10px] py-[7px] font-semibold" value={st.name} maxLength={40} onChange={e => patch(st.id, { name: e.target.value })} aria-label={s.nameLabel} placeholder={s.nameLabel} />
          <button className="icon-btn" onClick={() => setStyles(list => list.filter(x => x.id !== st.id))} aria-label={s.remove(st.name)}><Trash2 size={14} /></button></div>
        <textarea className="text-input min-h-[60px]" value={st.prompt} maxLength={4000} onChange={e => patch(st.id, { prompt: e.target.value })} aria-label={s.promptLabel(st.name)} placeholder={s.promptPlaceholder} />
      </div>)}
    </div>
    {sampleOpen && <div className="style-sample mt-[10px] rounded-[10px] border border-dashed border-line-strong p-[12px]">
      <label className="field"><span>{s.sample} <small className="muted inline ml-[6px] text-[9.5px] font-normal">{s.sampleHint}</small></span>
        <textarea className="text-input tall" value={sample} onChange={e => setSample(e.target.value)} placeholder={s.samplePlaceholder} /></label>
      <div className="form-actions start"><button className="btn-primary small" disabled={busy || sample.trim().length < 40 || !model} onClick={() => void fromSample()}><Sparkles size={13} className={busy ? "spin animate-spin" : ""} />{busy ? s.analyzing : s.createFromThis}</button>
        <button className="btn-text" onClick={() => setSampleOpen(false)}>{s.stop}</button></div>
    </div>}
    <div className="form-actions">{message && <span className="form-message">{message}</span>}
      <button className="btn-secondary small" onClick={() => setStyles(list => [...list, { id: newId(), name: "", prompt: "" }])}><Plus size={13} />{s.addManually}</button>
      {!sampleOpen && <button className="btn-secondary small" onClick={() => setSampleOpen(true)}><Sparkles size={13} />{s.createFromSample}</button>}
      <button className="btn-primary" onClick={() => void save()}>{s.save}</button></div>
  </>;
}

type MemoryFile = { path: string; size: number; content: string };

export default function PreferencesSection({ prefs, onSave, model, onUsage }: { prefs: Prefs; onSave: (prefs: Prefs) => Promise<void>; model: string; onUsage: (usage: Usage) => void }) {
  const t = useT();
  const m = t.settings.memory;
  const [memory, setMemory] = useState<MemoryFile[] | null>(null);
  useEffect(() => { window.continuity.listMemory().then(setMemory).catch(() => setMemory([])); }, []);
  const [editing, setEditing] = useState<{ path: string; text: string } | null>(null);
  const [adding, setAdding] = useState<{ name: string; text: string } | null>(null);
  const [memoryError, setMemoryError] = useState("");
  async function write(path: string, text: string) {
    setMemoryError("");
    try { await window.continuity.writeMemory(path, text); setEditing(null); setMemory(await window.continuity.listMemory()); return true; }
    catch (e) { setMemoryError((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")); return false; }
  }
  async function remove(path: string) {
    if (!window.confirm(m.confirmDelete(path))) return;
    await window.continuity.deleteMemory(path);
    setMemory(await window.continuity.listMemory());
  }
  return <section className="credit-form">
    <StylesEditor prefs={prefs} onSave={onSave} model={model} onUsage={onUsage} />
    <h3 className="spaced m-[26px_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">{m.heading}</h3>
    <p className="muted">{m.intro}</p>
    {memory === null ? <p className="hint">{t.common.loading}</p> : memory.length === 0 && !adding ? <p className="hint">{m.empty}</p> :
      <ul className="memory-list m-[8px_0_0] flex list-none flex-col gap-[6px] p-0">{memory.map(file => <li key={file.path} className="flex items-start gap-[6px] rounded-[8px] border border-line bg-inset px-[8px] py-[6px]">
        {editing?.path === file.path
          ? <div className="memory-edit flex min-w-0 flex-1 flex-col gap-[6px]"><code className="rounded-[4px] bg-surface px-[.35em] py-[.05em] font-mono text-[10.5px] text-muted">{file.path}</code>
            <textarea className="text-input tall" value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} aria-label={m.contentOf(file.path)} />
            <div className="form-actions start"><button className="btn-primary small" onClick={() => void write(file.path, editing.text)}>{t.common.save}</button><button className="btn-text" onClick={() => setEditing(null)}>{t.common.cancel}</button></div></div>
          : <details className="min-w-0 flex-1"><summary className="flex cursor-pointer items-center gap-[8px] text-[10.5px]"><code className="rounded-[4px] bg-surface px-[.35em] py-[.05em] font-mono text-[.9em]">{file.path}</code><small className="ml-auto text-subtle">{formatBytes(file.size)}</small></summary><pre className="m-[8px_0_2px] max-h-[200px] overflow-auto font-mono text-[10.5px] leading-[1.6] font-normal whitespace-pre-wrap text-muted">{file.content}</pre></details>}
        {editing?.path !== file.path && <button className="icon-btn" onClick={() => setEditing({ path: file.path, text: file.content })} aria-label={m.edit(file.path)}><Pencil size={14} /></button>}
        <button className="icon-btn" onClick={() => void remove(file.path)} aria-label={m.remove(file.path)}><Trash2 size={14} /></button>
      </li>)}</ul>}
    {adding
      ? <div className="memory-edit new mt-[10px] flex min-w-0 flex-1 flex-col gap-[6px] rounded-[10px] border border-dashed border-line-strong p-[10px]">
        <input className="text-input" value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} placeholder={m.fileNamePlaceholder} aria-label={m.fileNameLabel} />
        <textarea className="text-input tall" value={adding.text} onChange={e => setAdding({ ...adding, text: e.target.value })} placeholder={m.contentPlaceholder} aria-label={m.contentLabel} />
        <div className="form-actions start"><button className="btn-primary small" disabled={!adding.name.trim() || !adding.text.trim()} onClick={() => void write("/memories/" + adding.name.trim().replace(/[\\/]/g, "_"), adding.text).then(ok => { if (ok) setAdding(null); })}>{t.common.add}</button>
          <button className="btn-text" onClick={() => setAdding(null)}>{t.common.cancel}</button></div></div>
      : <div className="form-actions start"><button className="btn-secondary small" onClick={() => setAdding({ name: "", text: "" })}><Plus size={13} />{m.addMore}</button></div>}
    {memoryError && <p className="form-message error text-danger">{memoryError}</p>}
  </section>;
}
