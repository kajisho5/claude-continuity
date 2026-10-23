import { useEffect, useState } from "react";
import { CreditCard as CreditIcon, HardDrive, ExternalLink, Info, KeyRound, MessageSquareText, Plug, ShieldCheck, UserRound, X } from "lucide-react";
import CreditSettingsForm from "./CreditSettingsForm";
import PreferencesSection from "./PreferencesSection";
import McpSection from "./McpSection";
import DataSection from "./DataSection";
import UpdateSection from "./UpdateSection";
import type { CreditSettings } from "../lib/credit";
import { type Prefs } from "../lib/prefs";

export type SettingsTab = "general" | "api" | "credit" | "responses" | "data" | "mcp" | "about";
const TABS: { id: SettingsTab; label: string; icon: typeof KeyRound }[] = [
  { id: "general", label: "一般", icon: UserRound },
  { id: "api", label: "API キー", icon: KeyRound },
  { id: "credit", label: "クレジット", icon: CreditIcon },
  { id: "responses", label: "スタイルとメモリ", icon: MessageSquareText },
  { id: "data", label: "データとバックアップ", icon: HardDrive },
  { id: "mcp", label: "MCP 連携", icon: Plug },
  { id: "about", label: "このアプリについて", icon: Info }
];
const THEMES: { id: Prefs["theme"]; label: string }[] = [{ id: "system", label: "システム" }, { id: "light", label: "ライト" }, { id: "dark", label: "ダーク" }];
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
    <div className="settings" role="dialog" aria-modal="true" aria-label="設定" onMouseDown={e => e.stopPropagation()}>
      <nav className="settings-nav">
        <h2>設定</h2>
        {TABS.map(t => <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
          <t.icon size={16} />{t.label}{t.id === "api" && <span className={"dot " + (p.configured ? "green" : "")} />}</button>)}
      </nav>
      <div className="settings-body" key={tab}>
        <button className="settings-close ghost-btn" onClick={p.onClose} aria-label="閉じる"><X size={18} /></button>
        {tab === "general" && <>
          <h3>プロフィール</h3>
          <label className="field"><span>表示名</span>
            <input className="text-input" value={name} maxLength={40} placeholder="あいさつとサイドバーに表示します"
              onChange={e => setName(e.target.value)} onBlur={() => { if (name.trim() !== p.prefs.displayName) update({ displayName: name.trim() }); }}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></label>
          <label className="toggle-row"><span><b>Claude にこの名前で呼んでもらう</b><small>オンにすると、表示名を毎回の会話で Claude に伝えます。オフのときはこの PC の画面表示にだけ使います。</small></span>
            <input type="checkbox" className="switch" checked={p.prefs.shareName} disabled={!p.prefs.displayName} onChange={e => update({ shareName: e.target.checked })} /></label>
          <label className="field"><span>Claude に知っておいてほしいこと <small className="muted inline">すべての会話に適用されます</small></span>
            <textarea className="text-input" value={about} maxLength={4000} placeholder="例: 経営企画の仕事をしています。回答は結論から、数字には出典を付けてください。"
              onChange={e => setAbout(e.target.value)} onBlur={() => { if (about !== p.prefs.preferences) update({ preferences: about }); }} /></label>
          <h3 className="spaced">外観</h3>
          <div className="theme-grid" role="radiogroup" aria-label="テーマ">
            {THEMES.map(t => <button key={t.id} role="radio" aria-checked={p.prefs.theme === t.id} className={"theme-card" + (p.prefs.theme === t.id ? " active" : "")} onClick={() => update({ theme: t.id })}>
              <span className={"theme-preview " + t.id}><i /><i /><i /></span>{t.label}</button>)}
          </div>
          <h3 className="spaced">チャットのフォント</h3>
          <div className="theme-grid" role="radiogroup" aria-label="チャットのフォント">
            {FONTS.map(f => <button key={f.id} role="radio" aria-checked={p.prefs.chatFont === f.id} className={"theme-card" + (p.prefs.chatFont === f.id ? " active" : "")} onClick={() => update({ chatFont: f.id })}>
              <span className="font-preview" style={{ fontFamily: f.sample }}>Aa あ</span>{f.label}</button>)}
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
          <h3>Anthropic API キー</h3>
          <p className="muted">Anthropic Console で発行した API キーを入力してください。{p.configured ? "現在のキーは保存済みです。" : "まだ設定されていません。"}</p>
          <div className="key-row">
            <input className="text-input" type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={p.configured ? "保存済み。変更する場合のみ入力" : "sk-ant-…"} autoComplete="off" aria-label="API Key" />
            <button className="btn-primary" disabled={!key.trim()} onClick={() => void saveKey()}>保存</button>
          </div>
          {keyMessage && <p className="form-message">{keyMessage}</p>}
          <div className="hint"><ShieldCheck size={13} /> API キーは OS の安全な保存領域に暗号化して保存します。 <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">キーを作成 <ExternalLink size={11} /></a></div>
        </>}
        {tab === "credit" && <>
          <CreditSettingsForm value={p.credit} onSave={p.onSaveCredit} />
          <div className="credit-guide"><b>Max プランの月間 API クレジットを使う</b>
            <p>Max 5x は月 $100、Max 20x は月 $200 相当。請求サイクル末で失効し、繰り越されません。Claude Code では使えません（API・Agent SDK・Playground が対象）。</p>
            <a href="https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers" target="_blank" rel="noreferrer">公式設定手順</a>
            <a href="https://platform.claude.com/settings/billing" target="_blank" rel="noreferrer">Console の Billing を開く</a>
            <button className="link" onClick={p.onRestartOnboarding}>初期設定をやり直す</button></div>
        </>}
        {tab === "responses" && <PreferencesSection prefs={p.prefs} onSave={p.onSavePrefs} />}
        {tab === "data" && <DataSection onNotice={p.onNotice} />}
        {tab === "mcp" && <McpSection />}
        {tab === "about" && <>
          <h3>Claude Continuity</h3>
          <UpdateSection />
          <p className="muted">Claude のエクスポートを読み込み、Anthropic API で会話を続けるデスクトップアプリです。Anthropic の公式製品ではありません。</p>
          <small className="fineprint">このアプリは API キーで Anthropic API を呼び出します。リンク済み組織のクレジットが利用されます。購入済み残高への自動リロードはこのアプリから設定・変更しません。送信した会話文脈と添付ファイルは Anthropic API へ送られます。</small>
        </>}
      </div>
    </div>
  </div>;
}
