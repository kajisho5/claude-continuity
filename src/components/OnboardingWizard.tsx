import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, ShieldCheck } from "lucide-react";
import PlanPicker from "./PlanPicker";
import { PLAN_LABELS, PLAN_PRESETS, cycleRange, formatShortDate, type CreditSettings, type PlanId } from "../lib/credit";
import { formatUsd } from "../lib/pricing";

type Props = {
  keyConfigured: boolean;
  onFinish: (settings: CreditSettings, apiKey?: string) => Promise<void>;
  onSkip: () => Promise<void>;
};
type Step = 0 | 1 | 2;
const STEP_LABELS = ["プラン", "付与日", "APIキー"];
const DAY_MS = 24 * 60 * 60 * 1000;

export function Stepper({ step }: { step: Step }) {
  return <ol className="stepper">
    {STEP_LABELS.map((label, i) => <li key={label} className={i < step ? "done" : i === step ? "current" : ""}>
      <span className="stepper-dot">{i < step ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
      <span className="stepper-label">{label}</span>
    </li>)}
  </ol>;
}

export default function OnboardingWizard({ keyConfigured, onFinish, onSkip }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [teamAmount, setTeamAmount] = useState("");
  const [resetDay, setResetDay] = useState(new Date().getDate());
  const [showCalibration, setShowCalibration] = useState(false);
  const [balance, setBalance] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [keyCheck, setKeyCheck] = useState<{ state: "idle" | "testing" | "ok" | "error"; message?: string }>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const amount = plan === "team" ? Number(teamAmount) : plan ? PLAN_PRESETS[plan as "max5x" | "max20x" | "none"] : 0;
  const preview = useMemo(() => {
    const now = new Date();
    const { start, end } = cycleRange(resetDay, now);
    return { start, end, daysLeft: Math.ceil((end.getTime() - now.getTime()) / DAY_MS) };
  }, [resetDay]);
  const teamInvalid = plan === "team" && !(amount > 0 && amount <= 500);
  const balanceValue = balance.trim() === "" ? null : Number(balance);
  const balanceInvalid = balanceValue != null && !(Number.isFinite(balanceValue) && balanceValue >= 0);

  function settings(): CreditSettings {
    return {
      plan, monthlyAmountUsd: plan === "none" ? 0 : amount, resetDay, onboardingDone: true,
      ...(balanceValue != null && !balanceInvalid ? { calibration: { balanceUsd: balanceValue, observedAt: new Date().toISOString() } } : {})
    };
  }
  async function finish(withKey: boolean) {
    setBusy(true); setError("");
    try { await onFinish(settings(), withKey ? apiKey.trim() : undefined); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }
  function next() {
    // Credit-less plans have no grant day; an already-saved key skips the key step.
    const skipDay = step === 0 && plan === "none";
    if (step === 0 && !skipDay) { setStep(1); return; }
    if (keyConfigured) void finish(false);
    else setStep(2);
  }
  function back() { setStep(step === 2 && plan === "none" ? 0 : (Math.max(0, step - 1) as Step)); }
  async function testKey() {
    setKeyCheck({ state: "testing" });
    try {
      const result = await window.continuity.testApiKey(apiKey.trim());
      setKeyCheck({ state: "ok", message: `接続できました（利用可能なモデル ${result.modelCount} 件）` });
    } catch (e) {
      setKeyCheck({ state: "error", message: (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "") });
    }
  }

  return <div className="overlay onboarding">
    <div className="wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      <p className="eyebrow">はじめに設定 · {step + 1} / 3</p>
      {step === 0 && <>
        <h2 id="wizard-title">あなたのClaudeプランを選んでください</h2>
        <p className="lead">プランに応じて、毎月付与されるAPIクレジットの残額と失効日を管理します。</p>
        <Stepper step={0} />
        <PlanPicker value={plan} onChange={setPlan} />
        <p className="hint">ⓘ 自分のプランは claude.ai の Settings › Billing で確認できます。あとから「API設定」で変更できます。</p>
      </>}
      {step === 1 && <>
        <h2 id="wizard-title">クレジットが付与される日は？</h2>
        <p className="lead">claude.ai の Settings › Billing に表示される「次回請求日」の“日”を選んでください。</p>
        <Stepper step={1} />
        <div className="field-row">
          <label className="field">
            <span>毎月の付与日</span>
            <span className="day-input">毎月
              <select value={resetDay} onChange={e => setResetDay(Number(e.target.value))} aria-label="付与日">
                {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>日</span>
          </label>
          {plan === "team"
            ? <label className="field"><span>チームの月間合計額（USD・上限 $500）</span>
              <input className={"text-input" + (teamInvalid && teamAmount ? " invalid" : "")} inputMode="decimal" value={teamAmount}
                onChange={e => setTeamAmount(e.target.value)} placeholder="例: 260" /></label>
            : <div className="field"><span>選択中のプラン</span>
              <div className="plan-summary"><b>{plan ? PLAN_LABELS[plan] : ""}</b><small>月 {formatUsd(amount, 0)} の APIクレジット</small>
                <button className="link" onClick={() => setStep(0)}>変更</button></div></div>}
        </div>
        <div className="preview-box">
          <span>今のサイクルのプレビュー</span>
          <strong>{formatShortDate(preview.start)} 〜 {formatShortDate(preview.end)}<em> 失効まで </em><b>{preview.daysLeft}日</b>
            <em> · 付与額 {plan === "team" && teamInvalid ? "—" : formatUsd(amount, 0)}</em></strong>
          <small>付与時刻は非公開のため、日単位の目安です。</small>
        </div>
        <button className="disclosure" onClick={() => setShowCalibration(v => !v)} aria-expanded={showCalibration}>
          {showCalibration ? "▾" : "▸"} Console の残高で補正する（任意・あとからでも可）</button>
        {showCalibration && <div className="calibration">
          <p>Console › Billing › Promotional credits の残額を入力すると、Playground など他の利用分も含めた推定になります。</p>
          <input className={"text-input" + (balanceInvalid ? " invalid" : "")} inputMode="decimal" value={balance}
            onChange={e => setBalance(e.target.value)} placeholder="$ 残額（例: 132.50）" />
        </div>}
      </>}
      {step === 2 && <>
        <h2 id="wizard-title">Anthropic APIキーを入力</h2>
        <p className="lead">クレジットが付与された Console 組織で作成したキーを使います。</p>
        <Stepper step={2} />
        <ol className="key-guide">
          <li><b>クレジットを受け取る</b><span>claude.ai の Billing で「API credits」から Console 組織をリンクします。</span>
            <a href="https://claude.ai/settings/billing" target="_blank" rel="noreferrer">Billing を開く <ExternalLink size={12} /></a></li>
          <li><b>APIキーを作る</b><span>「Create key」→ 名前・期限・<em>ワークスペース</em>を選んで作成。キーは作成時に一度だけ表示されます。</span>
            <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">API keys を開く <ExternalLink size={12} /></a></li>
          <li><b>貼り付けて接続テスト</b><span>保存前に、キーでモデル一覧を取得できるか確認します。</span></li>
        </ol>
        <label className="field"><span>API Key</span>
          <div className="key-row">
            <input className="text-input" type="password" value={apiKey} autoComplete="off" placeholder="sk-ant-…"
              onChange={e => { setApiKey(e.target.value); setKeyCheck({ state: "idle" }); }} />
            <button className="btn-secondary" disabled={!apiKey.trim() || keyCheck.state === "testing"} onClick={() => void testKey()}>
              {keyCheck.state === "testing" ? "確認中…" : "接続テスト"}</button>
          </div>
        </label>
        {keyCheck.message && <p className={"key-check " + keyCheck.state}>{keyCheck.message}</p>}
        <p className="hint"><ShieldCheck size={13} /> OS の安全な保存領域に暗号化して保存します。</p>
        <p className="hint"><a href="https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers" target="_blank" rel="noreferrer">公式の受け取り手順</a></p>
      </>}
      {error && <p className="key-check error">{error}</p>}
      <footer className="wizard-actions">
        {step === 0
          ? <button className="btn-text" disabled={busy} onClick={() => { setBusy(true); void onSkip().finally(() => setBusy(false)); }}>あとで設定</button>
          : <button className="btn-secondary" disabled={busy} onClick={back}><ArrowLeft size={14} /> 戻る</button>}
        <span className="spacer" />
        {step === 2 && <button className="btn-text" disabled={busy} onClick={() => void finish(false)}>あとで入力</button>}
        {step < 2
          ? <button className="btn-primary" disabled={!plan || busy || (step === 1 && (teamInvalid || balanceInvalid))} onClick={next}>
            {(step === 1 || plan === "none") && keyConfigured ? "完了" : <>次へ <ArrowRight size={14} /></>}</button>
          : <button className="btn-primary" disabled={!apiKey.trim() || busy} onClick={() => void finish(true)}>保存して開始</button>}
      </footer>
    </div>
  </div>;
}
