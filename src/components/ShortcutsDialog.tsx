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
    <div className="modal shortcuts w-[min(460px,100%)]" role="dialog" aria-modal="true" aria-label="キーボードショートカット" onMouseDown={e => e.stopPropagation()}>
      <button className="settings-close ghost-btn absolute top-[14px] right-[14px]" onClick={onClose} aria-label="閉じる"><X size={18} /></button>
      <h2>キーボードショートカット</h2>
      <dl className="mx-0 mt-[14px] mb-0 flex flex-col">{SHORTCUTS.map(s => <div key={s.label} className="flex items-center justify-between gap-[12px] border-b border-line py-[9px]">
        <dt className="text-[13px] text-ink-3">{s.label}</dt>
        <dd className="m-0 flex gap-[4px]">{s.keys.map(k => <kbd key={k} className="m-0 bg-inset px-[7px] py-[4px] text-[11px] text-ink-4">{k}</kbd>)}</dd></div>)}</dl>
    </div>
  </div>;
}
