import { useEffect, useState } from "react";
import type { ConnectorView } from "../lib/connectors";
import { Cable, CreditCard as CreditIcon, HardDrive, ExternalLink, Info, KeyRound, MessageSquareText, Plug, ShieldCheck, UserRound, X } from "lucide-react";
import CreditSettingsForm from "./CreditSettingsForm";
import PreferencesSection from "./PreferencesSection";
import McpSection from "./McpSection";
import DataSection from "./DataSection";
import UpdateSection from "./UpdateSection";
import ConnectorsSection from "./ConnectorsSection";
import type { CreditSettings } from "../lib/credit";
import { type Prefs } from "../lib/prefs";

export type SettingsTab = "general" | "api" | "credit" | "responses" | "connectors" | "data" | "mcp" | "about";
const TABS: { id: SettingsTab; label: string; icon: typeof KeyRound }[] = [
  { id: "general", label: "一般", icon: UserRound },
  { id: "api", label: "API キー", icon: KeyRound },
  { id: "credit", label: "クレジット", icon: CreditIcon },
  { id: "responses", label: "スタイルとメモリ", icon: MessageSquareText },
  { id: "connectors", label: "コネクタ", icon: Cable },
  { id: "data", label: "データとバックアップ", icon: HardDrive },
  { id: "mcp", label: "Claude Code 連携", icon: Plug },
  { id: "about", label: "このアプリについて", icon: Info }
];
const THEMES: { id: Prefs["theme"]; label: string }[] = [{ id: "system", label: "システム" }, { id: "light", label: "ライト" }, { id: "dark", label: "ダーク" }];
const PREVIEWS: Record<Prefs["theme"], { box: string; bar: string }> = {
  light: { box: "border-[#E6E2D8] bg-[#FAF9F5]", bar: "bg-[#ECE9E0]" },
  dark: { box: "border-[#3B3A36] bg-[#262522]", bar: "bg-[#34332F]" },
  system: { box: "border-line-strong bg-[linear-gradient(115deg,#FAF9F5_50%,#262522_50%)]", bar: "bg-[#8B867B55]" }
};
/** Section headings sit directly in the settings body. */
const SETTINGS_H3 = "m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink";
const themeCard = (active: boolean) => "theme-card flex flex-col items-center gap-[8px] bg-transparent rounded-[12px] text-[12.5px] "
  + (active ? "active border-2 border-accent pt-[9px] px-[9px] pb-[8px] text-ink" : "border border-line-strong pt-[10px] px-[10px] pb-[9px] text-ink-3 hover:border-line-input");
const FONTS: { id: Prefs["chatFont"]; label: string; sample: string }[] = [
  { id: "serif", label: "明朝（既定）", sample: "var(--serif-body)" },
  { id: "sans", label: "ゴシック", sample: "var(--sans)" },
  { id: "system", label: "システム", sample: "system-ui, sans-serif" }
];

type Props = {
  initialTab?: SettingsTab;
  prefs: Prefs; onSavePrefs: (next: Prefs) => Promise<void>;
  configured: boolean; onSaveKey: (key: string) => Promise<void>;
  credit: CreditSettings | null; onSaveCredit: (next: CreditSettings) => Promise<void>; onRestartOnboarding: () => void;
  onClose: () => void; onNotice: (text: string, kind?: "ok" | "error") => void;
  onConnectors: (list: ConnectorView[]) => void;
  model: string; onUsage: (usage: Awaited<ReturnType<typeof window.continuity.styleFromSample>>["usage"]) => void;
};

/** Settings with a left-hand section list, like the Claude apps. Appearance changes apply immediately. */
export default function SettingsPage(p: Props) {
  const [tab, setTab] = useState<SettingsTab>(p.initialTab ?? "general");
  const [name, setName] = useState(p.prefs.displayName);
  const [about, setAbout] = useState(p.prefs.preferences);
  const [key, setKey] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  useEffect(() => {
    // A confirm dialog opened from a tab handles its own Escape.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector(".dialog")) { e.stopPropagation(); p.onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [p.onClose]);
  const update = (patch: Partial<Prefs>) => void p.onSavePrefs({ ...p.prefs, ...patch });
  async function saveKey() {
    try { await p.onSaveKey(key.trim()); setKey(""); setKeyMessage("保存しました。"); }
    catch (e) { setKeyMessage(e instanceof Error ? e.message : String(e)); }
  }

  return <div className="overlay" onMouseDown={p.onClose}>
    <div className="settings flex h-[min(640px,calc(100vh_-_40px))] w-[min(880px,100%)] animate-[popIn_.2s_var(--ease)_both] overflow-hidden rounded-[16px] border border-line-strong bg-modal shadow-[0_20px_80px_#0008] light:shadow-[0_1px_2px_#0000000f,0_16px_48px_#0000001f]" role="dialog" aria-modal="true" aria-label="設定" onMouseDown={e => e.stopPropagation()}>
      <nav className="settings-nav flex w-[210px] shrink-0 flex-col gap-[2px] border-r border-line bg-sidebar px-[10px] py-[20px]">
        <h2 className="m-[0_10px_14px] font-serif text-[18px] leading-[normal] font-semibold text-ink">設定</h2>
        {TABS.map(t => <button key={t.id} className={"flex items-center gap-[10px] rounded-[8px] border-0 px-[10px] py-[8px] text-left text-[13px] hover:bg-line [&_svg]:shrink-0 [&_svg]:text-muted "
          + (tab === t.id ? "active bg-line font-medium text-ink" : "bg-transparent text-ink-4")} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
          <t.icon size={16} />{t.label}{t.id === "api" && <span className={"dot ml-auto " + (p.configured ? "green" : "")} />}</button>)}
      </nav>
      <div className="settings-body relative min-w-0 flex-1 animate-[fadeIn_.16s_ease] overflow-auto pt-[28px] px-[34px] pb-[30px]" key={tab}>
        <button className="settings-close ghost-btn absolute top-[14px] right-[14px]" onClick={p.onClose} aria-label="閉じる"><X size={18} /></button>
        {tab === "general" && <>
          <h3 className={SETTINGS_H3}>プロフィール</h3>
          <label className="field"><span>表示名</span>
            <input className="text-input" value={name} maxLength={40} placeholder="あいさつとサイドバーに表示します"
              onChange={e => setName(e.target.value)} onBlur={() => { if (name.trim() !== p.prefs.displayName) update({ displayName: name.trim() }); }}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></label>
          <label className="toggle-row"><span><b>Claude にこの名前で呼んでもらう</b><small>オンにすると、表示名を毎回の会話で Claude に伝えます。オフのときはこの PC の画面表示にだけ使います。</small></span>
            <input type="checkbox" className="switch" checked={p.prefs.shareName} disabled={!p.prefs.displayName} onChange={e => update({ shareName: e.target.checked })} /></label>
          <label className="field"><span>Claude に知っておいてほしいこと <small className="muted inline ml-[6px] text-[9.5px] font-normal">すべての会話に適用されます</small></span>
            <textarea className="text-input" value={about} maxLength={4000} placeholder="例: 経営企画の仕事をしています。回答は結論から、数字には出典を付けてください。"
              onChange={e => setAbout(e.target.value)} onBlur={() => { if (about !== p.prefs.preferences) update({ preferences: about }); }} /></label>
          <h3 className={"spaced " + SETTINGS_H3 + " mt-[26px]"}>外観</h3>
          <div className="theme-grid mt-[10px] grid grid-cols-[repeat(3,1fr)] gap-[12px]" role="radiogroup" aria-label="テーマ">
            {THEMES.map(t => <button key={t.id} role="radio" aria-checked={p.prefs.theme === t.id} className={themeCard(p.prefs.theme === t.id)} onClick={() => update({ theme: t.id })}>
              <span className={`theme-preview ${t.id} flex h-[64px] w-full gap-[6px] overflow-hidden rounded-[8px] border p-[8px] ${PREVIEWS[t.id].box}`}>
                <i className={`block w-[26%] rounded-[4px] ${PREVIEWS[t.id].bar}`} /><i className={`block flex-1 rounded-[4px] ${PREVIEWS[t.id].bar}`} /><i className="hidden" /></span>{t.label}</button>)}
          </div>
          <h3 className={"spaced " + SETTINGS_H3 + " mt-[26px]"}>チャットのフォント</h3>
          <div className="theme-grid mt-[10px] grid grid-cols-[repeat(3,1fr)] gap-[12px]" role="radiogroup" aria-label="チャットのフォント">
            {FONTS.map(f => <button key={f.id} role="radio" aria-checked={p.prefs.chatFont === f.id} className={themeCard(p.prefs.chatFont === f.id)} onClick={() => update({ chatFont: f.id })}>
              <span className="font-preview grid h-[64px] w-full place-items-center rounded-[8px] border border-line bg-inset text-[22px] text-ink" style={{ fontFamily: f.sample }}>Aa あ</span>{f.label}</button>)}
          </div>
          <label className="toggle-row"><span><b>過去の会話を検索して参照する</b><small>関連しそうなとき、Claude がこの PC に保存された過去の会話を検索して文脈に使います。プロジェクト内の会話はそのプロジェクトの中だけを検索します。シークレットチャットでは使いません。</small></span>
            <input type="checkbox" className="switch" checked={p.prefs.searchPastChats} onChange={e => update({ searchPastChats: e.target.checked })} /></label>
          <label className="toggle-row"><span><b>回答が終わったら通知する</b><small>アプリが前面にないとき、OS の通知でお知らせします。通知をクリックするとその会話を開きます。</small></span>
            <input type="checkbox" className="switch" checked={p.prefs.notifyOnReply} onChange={e => update({ notifyOnReply: e.target.checked })} /></label>
          <label className="toggle-row"><span><b>アップデートを自動で確認する</b><small>起動時と数時間ごとに新しいバージョンを確認し、見つかったら通知します。ダウンロードはボタンを押したときだけです。</small></span>
            <input type="checkbox" className="switch" checked={p.prefs.checkUpdates} onChange={e => update({ checkUpdates: e.target.checked })} /></label>
          <label className="toggle-row"><span><b>会話タイトルを自動で付ける</b><small>最初の回答のあと、Haiku で短いタイトルを付けます（ごく少額のクレジットを使います）</small></span>
            <input type="checkbox" className="switch" checked={p.prefs.autoTitle} onChange={e => update({ autoTitle: e.target.checked })} /></label>
        </>}
        {tab === "api" && <>
          <h3 className={SETTINGS_H3}>Anthropic API キー</h3>
          <p className="muted">Anthropic Console で発行した API キーを入力してください。{p.configured ? "現在のキーは保存済みです。" : "まだ設定されていません。"}</p>
          <div className="key-row mt-[12px] flex gap-[8px]">
            <input className="text-input" type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={p.configured ? "保存済み。変更する場合のみ入力" : "sk-ant-…"} autoComplete="off" aria-label="API Key" />
            <button className="btn-primary" disabled={!key.trim()} onClick={() => void saveKey()}>保存</button>
          </div>
          {keyMessage && <p className="form-message">{keyMessage}</p>}
          <div className="hint"><ShieldCheck size={13} /> API キーは OS の安全な保存領域に暗号化して保存します。 <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">キーを作成 <ExternalLink size={11} /></a></div>
        </>}
        {tab === "credit" && <>
          <CreditSettingsForm value={p.credit} onSave={p.onSaveCredit} />
          <div className="credit-guide mt-[18px] flex flex-wrap items-center gap-x-[14px] gap-y-[4px] border-t border-line pt-[16px] text-[11px]"><b className="w-full text-ink-2">Max プランの月間 API クレジットを使う</b>
            <p className="m-[2px_0_4px] w-full text-[10px] leading-[1.7] text-muted">Max 5x は月 $100、Max 20x は月 $200 相当。請求サイクル末で失効し、繰り越されません。Claude Code では使えません（API・Agent SDK・Playground が対象）。</p>
            <a className="p-0 text-[10px]" href="https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers" target="_blank" rel="noreferrer">公式設定手順</a>
            <a className="p-0 text-[10px]" href="https://platform.claude.com/settings/billing" target="_blank" rel="noreferrer">Console の Billing を開く</a>
            <button className="link p-0 text-[10px]" onClick={p.onRestartOnboarding}>初期設定をやり直す</button></div>
        </>}
        {tab === "responses" && <PreferencesSection prefs={p.prefs} onSave={p.onSavePrefs} model={p.model} onUsage={p.onUsage} />}
        {tab === "connectors" && <ConnectorsSection onChange={p.onConnectors} />}
        {tab === "data" && <DataSection onNotice={p.onNotice} />}
        {tab === "mcp" && <McpSection />}
        {tab === "about" && <>
          <h3 className={SETTINGS_H3}>Claude Continuity</h3>
          <UpdateSection />
          <p className="muted">Claude のエクスポートを読み込み、Anthropic API で会話を続けるデスクトップアプリです。Anthropic の公式製品ではありません。</p>
          <small className="fineprint mt-[14px] block text-[9.5px] leading-[1.7] text-subtle">このアプリは API キーで Anthropic API を呼び出します。リンク済み組織のクレジットが利用されます。購入済み残高への自動リロードはこのアプリから設定・変更しません。送信した会話文脈と添付ファイルは Anthropic API へ送られます。</small>
        </>}
      </div>
    </div>
  </div>;
}
