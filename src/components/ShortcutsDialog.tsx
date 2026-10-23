import { useEffect } from "react";
import { X } from "lucide-react";

const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const MOD = IS_MAC ? "⌘" : "Ctrl";
const SHIFT = IS_MAC ? "⇧" : "Shift";
export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: [MOD, SHIFT, "O"], label: "新しい会話" },
  { keys: [MOD, "K"], label: "会話を検索" },
  { keys: [MOD, "/"], label: "入力欄へ移動" },
  { keys: [MOD, SHIFT, "S"], label: "サイドバーの開閉" },
  { keys: ["Enter"], label: "送信" },
  { keys: [SHIFT, "Enter"], label: "改行" },
  { keys: ["Esc"], label: "応答を停止 / パネルやダイアログを閉じる" },
  { keys: [MOD, SHIFT, "?"], label: "このショートカット一覧" }
];

export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return <div className="overlay" onMouseDown={onClose}>
    <div className="modal shortcuts" role="dialog" aria-modal="true" aria-label="キーボードショートカット" onMouseDown={e => e.stopPropagation()}>
      <button className="settings-close ghost-btn" onClick={onClose} aria-label="閉じる"><X size={18} /></button>
      <h2>キーボードショートカット</h2>
      <dl>{SHORTCUTS.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.keys.map(k => <kbd key={k}>{k}</kbd>)}</dd></div>)}</dl>
    </div>
  </div>;
}
