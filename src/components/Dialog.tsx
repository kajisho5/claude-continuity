import { useEffect, useRef, useState, type ReactNode } from "react";

function Frame({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return <div className="overlay" onMouseDown={onClose}>
    <div className="modal dialog w-[min(420px,100%)]" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()}>
      <h2>{title}</h2>{children}
    </div>
  </div>;
}

export function RenameDialog({ initial, onSave, onClose }: { initial: string; onSave: (title: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.select(); }, []);
  const submit = () => { const title = value.trim(); if (title) { onSave(title.slice(0, 300)); onClose(); } };
  return <Frame title="会話の名前を変更" onClose={onClose}>
    <input ref={input} className="text-input mt-[12px] text-[13.5px]" value={value} onChange={e => setValue(e.target.value)} aria-label="会話の名前" autoFocus
      onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(); }} />
    <div className="actions"><button className="btn-secondary" onClick={onClose}>キャンセル</button><button className="btn-primary" disabled={!value.trim()} onClick={submit}>保存</button></div>
  </Frame>;
}

export function ConfirmDialog({ title, body, confirm, onConfirm, onClose }: { title: string; body: string; confirm: string; onConfirm: () => void; onClose: () => void }) {
  return <Frame title={title} onClose={onClose}>
    <p className="dialog-body mx-0 mt-[10px] mb-0 text-[13px] leading-[1.7] text-ink-4">{body}</p>
    <div className="actions"><button className="btn-secondary" onClick={onClose}>キャンセル</button>
      <button className="btn-danger" autoFocus onClick={() => { onConfirm(); onClose(); }}>{confirm}</button></div>
  </Frame>;
}
