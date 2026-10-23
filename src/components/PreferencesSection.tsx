import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatBytes } from "./MessageItem";

type Prefs = { autoTitle: boolean; customStyle: string };
type MemoryFile = { path: string; size: number; content: string };

export default function PreferencesSection({ prefs, onSave }: { prefs: Prefs; onSave: (prefs: Prefs) => Promise<void> }) {
  const [draft, setDraft] = useState(prefs);
  const [memory, setMemory] = useState<MemoryFile[] | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { window.continuity.listMemory().then(setMemory).catch(() => setMemory([])); }, []);
  async function remove(path: string) {
    if (!window.confirm(`${path} を削除しますか？`)) return;
    await window.continuity.deleteMemory(path);
    setMemory(await window.continuity.listMemory());
  }
  return <section className="credit-form">
    <h3>応答の設定</h3>
    <label className="toggle-row"><span><b>会話タイトルを自動で付ける</b><small>最初の回答のあと、Haiku で短いタイトルを付けます（ごく少額のクレジットを使います）</small></span>
      <input type="checkbox" className="switch" checked={draft.autoTitle} onChange={e => setDraft({ ...draft, autoTitle: e.target.checked })} /></label>
    <label className="field"><span>カスタムスタイル</span>
      <textarea className="text-input" value={draft.customStyle} onChange={e => setDraft({ ...draft, customStyle: e.target.value })}
        placeholder="例: 箇条書き中心で、専門用語には短い補足を付けてください。" /></label>
    <div className="form-actions">{message && <span className="form-message">{message}</span>}
      <button className="btn-primary" onClick={() => void onSave(draft).then(() => setMessage("保存しました"))}>応答の設定を保存</button></div>
    <h3 className="spaced">メモリ</h3>
    <p className="muted">メモリをオンにした会話で Claude が保存した内容です。</p>
    {memory === null ? <p className="hint">読み込み中…</p> : memory.length === 0 ? <p className="hint">保存されたメモリはありません。</p> :
      <ul className="memory-list">{memory.map(file => <li key={file.path}>
        <details><summary><code>{file.path}</code><small>{formatBytes(file.size)}</small></summary><pre>{file.content}</pre></details>
        <button className="icon-btn" onClick={() => void remove(file.path)} aria-label={`${file.path} を削除`}><Trash2 size={14} /></button>
      </li>)}</ul>}
  </section>;
}
