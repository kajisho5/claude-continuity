import { useEffect, useRef, useState } from "react";
import type { ConnectorView } from "../lib/connectors";
import { Cable, Sparkles, CreditCard as CreditIcon, HardDrive, ExternalLink, Info, KeyRound, MessageSquareText, Plug, ShieldCheck, UserRound, X } from "lucide-react";
import CreditSettingsForm from "./CreditSettingsForm";
import LimitsSection, { LongChatsSection } from "./LimitsSection";
import PreferencesSection from "./PreferencesSection";
import McpSection from "./McpSection";
import DataSection from "./DataSection";
import UpdateSection from "./UpdateSection";
import ConnectorsSection from "./ConnectorsSection";
import SkillsSection from "./SkillsSection";
import type { CreditSettings } from "../lib/credit";
import { QUICK_SHORTCUTS, type Prefs, type QuickShortcut } from "../lib/prefs";
import { useT, type LanguagePref, type Messages } from "../i18n";

const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
/** "CommandOrControl+Alt+Space" → "⌘ ⌥ Space" on macOS, "Ctrl + Alt + Space" elsewhere. */
const shortcutLabel = (accelerator: string) => IS_MAC
  ? accelerator.replace("CommandOrControl", "⌘").replace("Shift", "⇧").replace("Alt", "⌥").split("+").join(" ")
  : accelerator.replace("CommandOrControl", "Ctrl").split("+").join(" + ");

export type SettingsTab = "general" | "api" | "credit" | "responses" | "skills" | "connectors" | "data" | "mcp" | "about";
const TABS: { id: SettingsTab; icon: typeof KeyRound }[] = [
  { id: "general", icon: UserRound },
  { id: "api", icon: KeyRound },
  { id: "credit", icon: CreditIcon },
  { id: "responses", icon: MessageSquareText },
  { id: "skills", icon: Sparkles },
  { id: "connectors", icon: Cable },
  { id: "data", icon: HardDrive },
  { id: "mcp", icon: Plug },
  { id: "about", icon: Info }
];
const THEMES: Prefs["theme"][] = ["system", "light", "dark"];
const PREVIEWS: Record<Prefs["theme"], { box: string; bar: string }> = {
  light: { box: "border-[#E6E2D8] bg-[#FAF9F5]", bar: "bg-[#ECE9E0]" },
  dark: { box: "border-[#3B3A36] bg-[#262522]", bar: "bg-[#34332F]" },
  system: { box: "border-line-strong bg-[linear-gradient(115deg,#FAF9F5_50%,#262522_50%)]", bar: "bg-[#8B867B55]" }
};
/** Section headings sit directly in the settings body. */
const SETTINGS_H3 = "m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink";
const themeCard = (active: boolean) => "theme-card flex flex-col items-center gap-[8px] bg-transparent rounded-[12px] text-[12.5px] "
  + (active ? "active border-2 border-accent pt-[9px] px-[9px] pb-[8px] text-ink" : "border border-line-strong pt-[10px] px-[10px] pb-[9px] text-ink-3 hover:border-line-input");
const FONTS: { id: Prefs["chatFont"]; sample: string }[] = [
  { id: "serif", sample: "var(--serif-body)" },
  { id: "sans", sample: "var(--sans)" },
  { id: "system", sample: "system-ui, sans-serif" }
];
/** Each language option previews its own script; labels come from `common.languageNames`, so they read the same in every UI language. */
const LANGUAGES: { id: LanguagePref; sample: string }[] = [{ id: "system", sample: "A / あ" }, { id: "ja", sample: "あ" }, { id: "en", sample: "Aa" }];
const languageLabel = (t: Messages, id: LanguagePref) => id === "system" ? t.common.languageSystem : t.common.languageNames[id];

type Props = {
  initialTab?: SettingsTab;
  prefs: Prefs; onSavePrefs: (next: Prefs | ((current: Prefs) => Prefs)) => Promise<void>;
  configured: boolean; onSaveKey: (key: string) => Promise<void>;
  credit: CreditSettings | null; onSaveCredit: (next: CreditSettings) => Promise<void>; onRestartOnboarding: () => void;
  onClose: () => void; onNotice: (text: string, kind?: "ok" | "error") => void;
  onConnectors: (list: ConnectorView[]) => void;
  model: string; onUsage: (usage: Awaited<ReturnType<typeof window.continuity.styleFromSample>>["usage"]) => void;
};

/** Settings with a left-hand section list, like the Claude apps. Appearance changes apply immediately. */
export default function SettingsPage(p: Props) {
  const t = useT();
  const [tab, setTab] = useState<SettingsTab>(p.initialTab ?? "general");
  const [name, setName] = useState(p.prefs.displayName);
  const [about, setAbout] = useState(p.prefs.preferences);
  const [key, setKey] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const update = (patch: Partial<Prefs>) => void p.onSavePrefs(current => ({ ...current, ...patch }));
  // The name and instructions are saved on blur; closing (Esc, the backdrop, a shortcut) skips blur, so
  // whatever is still unsaved is saved when the settings close.
  const draftRef = useRef({ name, about, prefs: p.prefs, save: p.onSavePrefs });
  draftRef.current = { name, about, prefs: p.prefs, save: p.onSavePrefs };
  useEffect(() => () => {
    const d = draftRef.current;
    const patch: Partial<Prefs> = {};
    if (d.name.trim() !== d.prefs.displayName) patch.displayName = d.name.trim();
    if (d.about !== d.prefs.preferences) patch.preferences = d.about;
    if (Object.keys(patch).length) void d.save(current => ({ ...current, ...patch }));
  }, []);
  const close = () => p.onClose();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    // A confirm dialog opened from a tab handles its own Escape.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.isComposing && e.keyCode !== 229 && !document.querySelector(".dialog")) { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  // Registration happens in the main process after saving; another app may already own the keys.
  const [shortcutError, setShortcutError] = useState("");
  useEffect(() => { void window.continuity.shortcutStatus().then(setShortcutError).catch(() => {}); }, [p.prefs.quickShortcut]);
  async function saveKey() {
    try { await p.onSaveKey(key.trim()); setKey(""); setKeyMessage(t.settings.api.savedMessage); }
    catch (e) { setKeyMessage(e instanceof Error ? e.message : String(e)); }
  }

  return <div className="overlay" onMouseDown={close}>
    <div className="settings flex h-[min(640px,calc(100vh_-_40px))] w-[min(880px,100%)] animate-[popIn_.2s_var(--ease)_both] overflow-hidden rounded-[16px] border border-line-strong bg-modal shadow-[0_20px_80px_#0008] light:shadow-[0_1px_2px_#0000000f,0_16px_48px_#0000001f]" role="dialog" aria-modal="true" aria-label={t.settings.title} onMouseDown={e => e.stopPropagation()}>
      <nav className="settings-nav flex w-[210px] shrink-0 flex-col gap-[2px] border-r border-line bg-sidebar px-[10px] py-[20px]">
        <h2 className="m-[0_10px_14px] font-serif text-[18px] leading-[normal] font-semibold text-ink">{t.settings.title}</h2>
        {TABS.map(item => <button key={item.id} className={"flex items-center gap-[10px] rounded-[8px] border-0 px-[10px] py-[8px] text-left text-[13px] hover:bg-line [&_svg]:shrink-0 [&_svg]:text-muted "
          + (tab === item.id ? "active bg-line font-medium text-ink" : "bg-transparent text-ink-4")} onClick={() => setTab(item.id)} aria-current={tab === item.id}>
          <item.icon size={16} />{t.settings.tabs[item.id]}{item.id === "api" && <span className={"dot ml-auto " + (p.configured ? "green" : "")} />}</button>)}
      </nav>
      <div className="settings-body relative min-w-0 flex-1 animate-[fadeIn_.16s_ease] overflow-auto pt-[28px] px-[34px] pb-[30px]" key={tab}>
        <button className="settings-close ghost-btn absolute top-[14px] right-[14px]" onClick={close} aria-label={t.common.close}><X size={18} /></button>
        {tab === "general" && <>
          <h3 className={SETTINGS_H3}>{t.settings.general.profile}</h3>
          <label className="field"><span>{t.settings.general.displayName}</span>
            <input className="text-input" value={name} maxLength={40} placeholder={t.settings.general.displayNamePlaceholder}
              onChange={e => setName(e.target.value)} onBlur={() => { if (name.trim() !== p.prefs.displayName) update({ displayName: name.trim() }); }}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></label>
          <label className="toggle-row"><span><b>{t.settings.general.shareName}</b><small>{t.settings.general.shareNameHint}</small></span>
            <input type="checkbox" className="switch" checked={p.prefs.shareName} disabled={!p.prefs.displayName} onChange={e => update({ shareName: e.target.checked })} /></label>
          <label className="field"><span>{t.settings.general.about} <small className="muted inline ml-[6px] text-[9.5px] font-normal">{t.settings.general.aboutHint}</small></span>
            <textarea className="text-input" value={about} maxLength={4000} placeholder={t.settings.general.aboutPlaceholder}
              onChange={e => setAbout(e.target.value)} onBlur={() => { if (about !== p.prefs.preferences) update({ preferences: about }); }} /></label>
          <h3 className={"spaced " + SETTINGS_H3 + " mt-[26px]"}>{t.settings.general.appearance}</h3>
          <div className="theme-grid mt-[10px] grid grid-cols-[repeat(3,1fr)] gap-[12px]" role="radiogroup" aria-label={t.settings.general.theme}>
            {THEMES.map(id => <button key={id} role="radio" aria-checked={p.prefs.theme === id} className={themeCard(p.prefs.theme === id)} onClick={() => update({ theme: id })}>
              <span className={`theme-preview ${id} flex h-[64px] w-full gap-[6px] overflow-hidden rounded-[8px] border p-[8px] ${PREVIEWS[id].box}`}>
                <i className={`block w-[26%] rounded-[4px] ${PREVIEWS[id].bar}`} /><i className={`block flex-1 rounded-[4px] ${PREVIEWS[id].bar}`} /><i className="hidden" /></span>{t.settings.general.themes[id]}</button>)}
          </div>
          <h3 className={"spaced " + SETTINGS_H3 + " mt-[26px]"}>{t.settings.general.chatFont}</h3>
          <div className="theme-grid mt-[10px] grid grid-cols-[repeat(3,1fr)] gap-[12px]" role="radiogroup" aria-label={t.settings.general.chatFont}>
            {FONTS.map(f => <button key={f.id} role="radio" aria-checked={p.prefs.chatFont === f.id} className={themeCard(p.prefs.chatFont === f.id)} onClick={() => update({ chatFont: f.id })}>
              <span className="font-preview grid h-[64px] w-full place-items-center rounded-[8px] border border-line bg-inset text-[22px] text-ink" style={{ fontFamily: f.sample }}>Aa あ</span>{t.settings.general.fonts[f.id]}</button>)}
          </div>
          <h3 className={"spaced " + SETTINGS_H3 + " mt-[26px]"}>{t.common.language} <small className="muted inline ml-[6px] font-sans text-[9.5px] font-normal">{t.settings.general.languageHint}</small></h3>
          <div className="theme-grid mt-[10px] grid grid-cols-[repeat(3,1fr)] gap-[12px]" role="radiogroup" aria-label={t.common.language}>
            {LANGUAGES.map(l => <button key={l.id} role="radio" aria-checked={p.prefs.language === l.id} className={themeCard(p.prefs.language === l.id)} onClick={() => update({ language: l.id })}>
              <span className="font-preview grid h-[64px] w-full place-items-center rounded-[8px] border border-line bg-inset text-[22px] text-ink" lang={l.id === "system" ? undefined : l.id}>{l.sample}</span>{languageLabel(t, l.id)}</button>)}
          </div>
          <label className="toggle-row quick-shortcut"><span><b>{t.settings.general.quickShortcut}</b><small>{t.settings.general.quickShortcutHint}</small>{shortcutError && <small className="text-warn">{shortcutError}</small>}</span>
            <select className="rounded-[6px] border border-line-input bg-surface-2 px-[8px] py-[5px] text-[12.5px] text-ink" value={p.prefs.quickShortcut} aria-label={t.settings.general.quickShortcut}
              onChange={e => update({ quickShortcut: e.target.value as QuickShortcut })}>
              {QUICK_SHORTCUTS.map(s => <option key={s} value={s}>{s ? shortcutLabel(s) : t.settings.general.quickShortcutOff}</option>)}
            </select></label>
          <label className="toggle-row"><span><b>{t.settings.general.searchPastChats}</b><small>{t.settings.general.searchPastChatsHint}</small></span>
            <input type="checkbox" className="switch" checked={p.prefs.referencePastChats} onChange={e => update({ referencePastChats: e.target.checked })} /></label>
          <label className="toggle-row"><span><b>{t.settings.general.notifyOnReply}</b><small>{t.settings.general.notifyOnReplyHint}</small></span>
            <input type="checkbox" className="switch" checked={p.prefs.notifyOnReply} onChange={e => update({ notifyOnReply: e.target.checked })} /></label>
          <label className="toggle-row"><span><b>{t.settings.general.checkUpdates}</b><small>{t.settings.general.checkUpdatesHint}</small></span>
            <input type="checkbox" className="switch" checked={p.prefs.checkUpdates} onChange={e => update({ checkUpdates: e.target.checked })} /></label>
          <label className="toggle-row"><span><b>{t.settings.general.autoTitle}</b><small>{t.settings.general.autoTitleHint}</small></span>
            <input type="checkbox" className="switch" checked={p.prefs.autoTitle} onChange={e => update({ autoTitle: e.target.checked })} /></label>
        </>}
        {tab === "api" && <>
          <h3 className={SETTINGS_H3}>{t.settings.api.heading}</h3>
          <p className="muted">{t.settings.api.intro}{p.configured ? t.settings.api.saved : t.settings.api.notSet}</p>
          <div className="key-row mt-[12px] flex gap-[8px]">
            <input className="text-input" type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={p.configured ? t.settings.api.placeholderSaved : "sk-ant-…"} autoComplete="off" aria-label="API Key" />
            <button className="btn-primary" disabled={!key.trim()} onClick={() => void saveKey()}>{t.common.save}</button>
          </div>
          {keyMessage && <p className="form-message">{keyMessage}</p>}
          <div className="hint"><ShieldCheck size={13} /> {t.settings.api.storage} <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">{t.settings.api.createKey} <ExternalLink size={11} /></a></div>
        </>}
        {tab === "credit" && <>
          <CreditSettingsForm value={p.credit} onSave={p.onSaveCredit} />
          <div className="credit-guide mt-[18px] flex flex-wrap items-center gap-x-[14px] gap-y-[4px] border-t border-line pt-[16px] text-[11px]"><b className="w-full text-ink-2">{t.settings.creditGuide.heading}</b>
            <p className="m-[2px_0_4px] w-full text-[10px] leading-[1.7] text-muted">{t.settings.creditGuide.body}</p>
            <a className="p-0 text-[10px]" href="https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers" target="_blank" rel="noreferrer">{t.settings.creditGuide.officialSteps}</a>
            <a className="p-0 text-[10px]" href="https://platform.claude.com/settings/billing" target="_blank" rel="noreferrer">{t.settings.creditGuide.openBilling}</a>
            <button className="link p-0 text-[10px]" onClick={p.onRestartOnboarding}>{t.settings.creditGuide.restartOnboarding}</button></div>
          <LimitsSection prefs={p.prefs} onSave={change => p.onSavePrefs(change)} />
        </>}
        {tab === "responses" && <><PreferencesSection prefs={p.prefs} onSave={p.onSavePrefs} model={p.model} onUsage={p.onUsage} />
          <LongChatsSection prefs={p.prefs} onSave={change => p.onSavePrefs(change)} /></>}
        {tab === "skills" && <SkillsSection prefs={p.prefs} configured={p.configured} onSavePrefs={next => void p.onSavePrefs(next)} onReloadPrefs={() => void window.continuity.loadPrefs().then(p.onSavePrefs)} />}
        {tab === "connectors" && <ConnectorsSection onChange={p.onConnectors} />}
        {tab === "data" && <DataSection onNotice={p.onNotice} />}
        {tab === "mcp" && <McpSection />}
        {tab === "about" && <>
          <h3 className={SETTINGS_H3}>Claude Continuity</h3>
          <UpdateSection />
          <p className="muted">{t.settings.about.description}</p>
          <small className="fineprint mt-[14px] block text-[9.5px] leading-[1.7] text-subtle">{t.settings.about.fineprint}</small>
        </>}
      </div>
    </div>
  </div>;
}
