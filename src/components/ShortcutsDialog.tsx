import { useEffect } from "react";
import { X } from "lucide-react";
import { useT, type Messages } from "../i18n";

const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const MOD = IS_MAC ? "⌘" : "Ctrl";
const SHIFT = IS_MAC ? "⇧" : "Shift";
export const shortcuts = (t: Messages): { keys: string[]; label: string }[] => [
  { keys: [MOD, SHIFT, "O"], label: t.dialogs.shortcuts.newChat },
  { keys: [MOD, "K"], label: t.dialogs.shortcuts.searchChats },
  { keys: [MOD, "/"], label: t.dialogs.shortcuts.focusInput },
  { keys: [MOD, SHIFT, "S"], label: t.dialogs.shortcuts.toggleSidebar },
  { keys: ["Enter"], label: t.dialogs.shortcuts.send },
  { keys: [SHIFT, "Enter"], label: t.dialogs.shortcuts.newline },
  { keys: ["Esc"], label: t.dialogs.shortcuts.stopOrClose },
  { keys: [MOD, SHIFT, "?"], label: t.dialogs.shortcuts.showShortcuts }
];

export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return <div className="overlay" onMouseDown={onClose}>
    <div className="modal shortcuts w-[min(460px,100%)]" role="dialog" aria-modal="true" aria-label={t.dialogs.shortcuts.title} onMouseDown={e => e.stopPropagation()}>
      <button className="settings-close ghost-btn absolute top-[14px] right-[14px]" onClick={onClose} aria-label={t.common.close}><X size={18} /></button>
      <h2>{t.dialogs.shortcuts.title}</h2>
      <dl className="mx-0 mt-[14px] mb-0 flex flex-col">{shortcuts(t).map(s => <div key={s.label} className="flex items-center justify-between gap-[12px] border-b border-line py-[9px]">
        <dt className="text-[13px] text-ink-3">{s.label}</dt>
        <dd className="m-0 flex gap-[4px]">{s.keys.map(k => <kbd key={k} className="m-0 bg-inset px-[7px] py-[4px] text-[11px] text-ink-4">{k}</kbd>)}</dd></div>)}</dl>
    </div>
  </div>;
}
