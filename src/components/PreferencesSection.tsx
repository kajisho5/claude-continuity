import { useEffect, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { formatBytes } from "./MessageItem";
import { type CustomStyle, type Prefs } from "../lib/prefs";

type Usage = Awaited<ReturnType<typeof window.continuity.styleFromSample>>["usage"];
const newId = () => Math.random().toString(36).slice(2, 10);

/** Several named custom styles, written by hand or generated from a writing sample. */
function StylesEditor({ prefs, onSave, model, onUsage }: { prefs: Prefs; onSave: (prefs: Prefs) => Promise<void>; model: string; onUsage: (usage: Usage) => void }) {
  const [styles, setStyles] = useState<CustomStyle[]>(prefs.customStyles);
  const [sample, setSample] = useState("");
  const [sampleOpen, setSampleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const patch = (id: string, change: Partial<CustomStyle>) => setStyles(list => list.map(st => st.id === id ? { ...st, ...change } : st));
  async function save(next = styles) {
    const clean = next.filter(st => st.prompt.trim()).map(st => ({ ...st, name: st.name.trim() || "スタイル" }));
    await onSave({ ...prefs, customStyles: clean });
    setStyles(clean); setMessage("保存しました");
  }
  async function fromSample() {
    setBusy(true); setMessage("");
    try {
      const result = await window.continuity.styleFromSample({ sample, model });
      onUsage(result.usage);
      setStyles(list => [...list, { id: newId(), name: "サンプルから作成", prompt: result.prompt }]);
      setSample(""); setSampleOpen(false); setMessage("指示文を作成しました。名前を付けて保存してください。");
    } catch (e) { setMessage((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")); }
    finally { setBusy(false); }
  }
  return <>
    <h3>カスタムスタイル</h3>
    <p className="muted">入力欄のツール →「スタイルを使用」から選べます。</p>
    <div className="style-editor-list">
      {styles.map(st => <div key={st.id} className="style-editor">
        <div className="style-editor-head"><input className="text-input" value={st.name} maxLength={40} onChange={e => patch(st.id, { name: e.target.value })} aria-label="スタイル名" placeholder="スタイル名" />
          <button className="icon-btn" onClick={() => setStyles(list => list.filter(x => x.id !== st.id))} aria-label={`${st.name} を削除`}><Trash2 size={14} /></button></div>
        <textarea className="text-input" value={st.prompt} maxLength={4000} onChange={e => patch(st.id, { prompt: e.target.value })} aria-label={`${st.name} の指示`} placeholder="例: 箇条書き中心で、専門用語には短い補足を付けてください。" />
      </div>)}
    </div>
    {sampleOpen && <div className="style-sample">
      <label className="field"><span>文章サンプル <small className="muted inline">自分の書いた文章やお手本を貼り付けてください。書き方だけを真似します</small></span>
        <textarea className="text-input tall" value={sample} onChange={e => setSample(e.target.value)} placeholder="ここにサンプルの文章を貼り付け（40文字以上）" /></label>
      <div className="form-actions start"><button className="btn-primary small" disabled={busy || sample.trim().length < 40 || !model} onClick={() => void fromSample()}><Sparkles size={13} className={busy ? "spin" : ""} />{busy ? "分析しています…" : "このサンプルからスタイルを作る"}</button>
        <button className="btn-text" onClick={() => setSampleOpen(false)}>やめる</button></div>
    </div>}
    <div className="form-actions">{message && <span className="form-message">{message}</span>}
      <button className="btn-secondary small" onClick={() => setStyles(list => [...list, { id: newId(), name: "", prompt: "" }])}><Plus size={13} />手動で追加</button>
      {!sampleOpen && <button className="btn-secondary small" onClick={() => setSampleOpen(true)}><Sparkles size={13} />文章サンプルから作成</button>}
      <button className="btn-primary" onClick={() => void save()}>スタイルを保存</button></div>
  </>;
}

type MemoryFile = { path: string; size: number; content: string };

export default function PreferencesSection({ prefs, onSave, model, onUsage }: { prefs: Prefs; onSave: (prefs: Prefs) => Promise<void>; model: string; onUsage: (usage: Usage) => void }) {
  const [memory, setMemory] = useState<MemoryFile[] | null>(null);
  useEffect(() => { window.continuity.listMemory().then(setMemory).catch(() => setMemory([])); }, []);
  async function remove(path: string) {
    if (!window.confirm(`${path} を削除しますか？`)) return;
    await window.continuity.deleteMemory(path);
    setMemory(await window.continuity.listMemory());
  }
  return <section className="credit-form">
    <StylesEditor prefs={prefs} onSave={onSave} model={model} onUsage={onUsage} />
    <h3 className="spaced">メモリ</h3>
    <p className="muted">メモリをオンにした会話で Claude が保存した内容です。</p>
    {memory === null ? <p className="hint">読み込み中…</p> : memory.length === 0 ? <p className="hint">保存されたメモリはありません。</p> :
      <ul className="memory-list">{memory.map(file => <li key={file.path}>
        <details><summary><code>{file.path}</code><small>{formatBytes(file.size)}</small></summary><pre>{file.content}</pre></details>
        <button className="icon-btn" onClick={() => void remove(file.path)} aria-label={`${file.path} を削除`}><Trash2 size={14} /></button>
      </li>)}</ul>}
  </section>;
}
