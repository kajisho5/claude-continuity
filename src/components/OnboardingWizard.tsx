import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, ShieldCheck } from "lucide-react";
import PlanPicker from "./PlanPicker";
import { PLAN_LABELS, PLAN_PRESETS, cycleRange, formatShortDate, type CreditSettings, type PlanId, parseAmount } from "../lib/credit";
import { formatUsd } from "../lib/pricing";
import { useT } from "../i18n";

type Props = {
  keyConfigured: boolean;
  onFinish: (settings: CreditSettings, apiKey?: string) => Promise<void>;
  onSkip: () => Promise<void>;
};
type Step = 0 | 1 | 2;
const STEP_KEYS = ["plan", "day", "key"] as const;
const H2 = "m-[0_0_8px] font-serif text-[21px] font-bold text-ink";
const LEAD = "lead m-0 text-[11px] text-muted";
const KEY_CHECK = "key-check m-[8px_0_0] text-[11px]";
const STEP_LI = "[counter-increment:step] relative flex flex-col gap-[3px] rounded-[10px] border border-line bg-inset py-[11px] pr-[14px] pl-[46px] text-[10.5px] text-muted"
  + " before:absolute before:top-[12px] before:left-[14px] before:grid before:size-[20px] before:place-items-center before:rounded-full before:border before:border-line-input before:bg-surface-2"
  + " before:text-[10px] before:font-bold before:text-ink-2 before:content-[counter(step)]";
const STEP_LINK = "mt-[2px] inline-flex items-center gap-[4px] text-[10.5px]";
const STEP_B = "text-[11.5px] text-ink-2";
const PREVIEW_EM = "font-sans text-[12px] font-normal text-muted not-italic";
const WIZARD_PRIMARY = "min-w-[120px] px-[16px] py-[11px] text-[13px]";
const DAY_MS = 24 * 60 * 60 * 1000;

export function Stepper({ step }: { step: Step }) {
  const t = useT();
  return <ol className="stepper m-[22px_0_24px] flex list-none justify-center p-0">
    {STEP_KEYS.map(id => t.onboarding.steps[id]).map((label, i) => <li key={label} className={"relative flex w-[150px] flex-col items-center gap-[6px] text-[10px] not-last:after:absolute not-last:after:top-[11px] not-last:after:left-[calc(50%+14px)] not-last:after:h-[1.5px] not-last:after:w-[122px] not-last:after:content-['']"
      + (i < step ? " done text-muted not-last:after:bg-ok" : i === step ? " current font-semibold text-ink-2 not-last:after:bg-line-strong" : " text-muted not-last:after:bg-line-strong")}>
      <span className={"stepper-dot grid size-[22px] place-items-center rounded-full border text-[11px] font-bold "
        + (i < step ? "border-ok bg-ok text-[#0f1a14]" : i === step ? "border-accent bg-accent text-on-accent" : "border-line-input bg-surface-2 text-muted")}>{i < step ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
      <span className="stepper-label">{label}</span>
    </li>)}
  </ol>;
}

export default function OnboardingWizard({ keyConfigured, onFinish, onSkip }: Props) {
  const t = useT();
  const o = t.onboarding;
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

  const amount = plan === "team" ? parseAmount(teamAmount) : plan ? PLAN_PRESETS[plan as "max5x" | "max20x" | "none"] : 0;
  const preview = useMemo(() => {
    const now = new Date();
    const { start, end } = cycleRange(resetDay, now);
    return { start, end, daysLeft: Math.ceil((end.getTime() - now.getTime()) / DAY_MS) };
  }, [resetDay]);
  // Same bounds as Settings > Credits.
  const teamInvalid = plan === "team" && !(amount > 0 && amount <= 10000);
  const balanceValue = balance.trim() === "" ? null : parseAmount(balance);
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
      setKeyCheck({ state: "ok", message: o.keyConnected(result.modelCount) });
    } catch (e) {
      setKeyCheck({ state: "error", message: (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "") });
    }
  }

  return <div className="overlay onboarding bg-[#000b] light:bg-[#2a262040]">
    <div className="wizard max-h-[calc(100vh-40px)] w-[min(700px,100%)] animate-[popIn_.2s_var(--ease)_both] overflow-auto rounded-[16px] border border-line-strong bg-modal px-[32px] pt-[30px] pb-[22px] shadow-[0_20px_80px_#0009] light:shadow-[0_1px_2px_#0000000f,0_16px_48px_#0000001f]" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      <p className="eyebrow m-[0_0_10px] text-[10px] font-medium tracking-[.6px] text-muted">{o.eyebrow(step + 1)}</p>
      {step === 0 && <>
        <h2 id="wizard-title" className={H2}>{o.plan.title}</h2>
        <p className={LEAD}>{o.plan.lead}</p>
        <Stepper step={0} />
        <PlanPicker value={plan} onChange={setPlan} />
        <p className="hint">{o.plan.hint}</p>
      </>}
      {step === 1 && <>
        <h2 id="wizard-title" className={H2}>{o.day.title}</h2>
        <p className={LEAD}>{o.day.lead}</p>
        <Stepper step={1} />
        <div className="field-row flex gap-[14px]">
          <label className="field">
            <span>{o.day.resetDay}</span>
            <span className="day-input flex items-center gap-[8px] rounded-[8px] border border-line-input bg-inset px-[12px] py-[6px] text-[13px] text-muted">{t.credit.dayBefore}
              <select className="rounded-[6px] border border-line-input bg-surface-2 px-[8px] py-[5px] text-[14px] font-bold text-ink" value={resetDay} onChange={e => setResetDay(Number(e.target.value))} aria-label={t.credit.dayLabel}>
                {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>{t.credit.dayAfter}</span>
          </label>
          {plan === "team"
            ? <label className="field"><span>{o.day.teamAmount}</span>
              <input className={"text-input" + (teamInvalid && teamAmount ? " invalid border-danger" : "")} inputMode="decimal" value={teamAmount}
                onChange={e => setTeamAmount(e.target.value)} placeholder={o.day.teamPlaceholder} /></label>
            : <div className="field"><span>{o.day.selectedPlan}</span>
              <div className="plan-summary flex items-center gap-[10px] rounded-[9px] border border-line bg-inset px-[14px] py-[10px]"><b className="font-serif text-[14px] text-ink">{plan ? PLAN_LABELS[plan] : ""}</b><small className="flex-1 text-[10px] text-muted">{o.day.perMonth(formatUsd(amount, 0))}</small>
                <button className="link" onClick={() => setStep(0)}>{o.day.change}</button></div></div>}
        </div>
        <div className="preview-box mt-[18px] flex flex-col gap-[5px] rounded-[10px] border border-line bg-inset px-[16px] py-[13px]">
          <span className="text-[10px] text-muted">{o.day.preview}</span>
          <strong className="font-serif text-[15px] text-ink">{t.credit.range(formatShortDate(preview.start), formatShortDate(preview.end))}<em className={PREVIEW_EM}>{o.day.expiresIn}</em><b className="text-warn">{o.day.days(preview.daysLeft)}</b>
            <em className={PREVIEW_EM}>{o.day.grant(plan === "team" && teamInvalid ? "—" : formatUsd(amount, 0))}</em></strong>
          <small className="text-[9px] text-faint">{o.day.approx}</small>
        </div>
        <button className="disclosure border-0 bg-transparent px-0 pt-[14px] pb-0 text-left text-[11px] text-muted" onClick={() => setShowCalibration(v => !v)} aria-expanded={showCalibration}>
          {showCalibration ? "▾" : "▸"} {o.day.calibrate}</button>
        {showCalibration && <div className="calibration mt-[14px] rounded-[10px] border border-line bg-inset px-[14px] py-[13px] text-[11px]">
          <p className="m-[5px_0_10px] text-[10px] leading-[1.6] text-muted">{t.credit.calibrationIntro}</p>
          <input className={"text-input" + (balanceInvalid ? " invalid border-danger" : "")} inputMode="decimal" value={balance}
            onChange={e => setBalance(e.target.value)} placeholder={o.day.balancePlaceholder} />
        </div>}
      </>}
      {step === 2 && <>
        <h2 id="wizard-title" className={H2}>{o.key.title}</h2>
        <p className={LEAD}>{o.key.lead}</p>
        <Stepper step={2} />
        <ol className="key-guide m-[0_0_6px] flex list-none flex-col gap-[10px] p-0 [counter-reset:step]">
          <li className={STEP_LI}><b className={STEP_B}>{o.key.receiveTitle}</b><span>{o.key.receiveBody}</span>
            <a className={STEP_LINK} href="https://claude.ai/settings/billing" target="_blank" rel="noreferrer">{o.key.openBilling} <ExternalLink size={12} /></a></li>
          <li className={STEP_LI}><b className={STEP_B}>{o.key.createTitle}</b><span>{o.key.createBefore}<em className="font-semibold text-warn not-italic">{o.key.createWorkspace}</em>{o.key.createAfter}</span>
            <a className={STEP_LINK} href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">{o.key.openKeys} <ExternalLink size={12} /></a></li>
          <li className={STEP_LI}><b className={STEP_B}>{o.key.testTitle}</b><span>{o.key.testBody}</span></li>
        </ol>
        <label className="field"><span>API Key</span>
          <div className="key-row flex gap-[8px]">
            <input className="text-input" type="password" value={apiKey} autoComplete="off" placeholder="sk-ant-…"
              onChange={e => { setApiKey(e.target.value); setKeyCheck({ state: "idle" }); }} />
            <button className="btn-secondary whitespace-nowrap" disabled={!apiKey.trim() || keyCheck.state === "testing"} onClick={() => void testKey()}>
              {keyCheck.state === "testing" ? o.key.testing : o.key.test}</button>
          </div>
        </label>
        {keyCheck.message && <p className={KEY_CHECK + " " + keyCheck.state + (keyCheck.state === "ok" ? " text-ok" : keyCheck.state === "error" ? " text-danger" : "")}>{keyCheck.message}</p>}
        <p className="hint"><ShieldCheck size={13} /> {o.key.storage}</p>
        <p className="hint"><a href="https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers" target="_blank" rel="noreferrer">{o.key.officialSteps}</a></p>
      </>}
      {error && <p className={KEY_CHECK + " error text-danger"}>{error}</p>}
      <footer className="wizard-actions m-[24px_-32px_0] flex items-center gap-[10px] border-t border-line px-[32px] pt-[16px] pb-0">
        {step === 0
          ? <button className="btn-text" disabled={busy} onClick={() => { setBusy(true); void onSkip().finally(() => setBusy(false)); }}>{o.later}</button>
          : <button className="btn-secondary" disabled={busy} onClick={back}><ArrowLeft size={14} /> {o.back}</button>}
        <span className="spacer flex-1" />
        {step === 2 && <button className="btn-text" disabled={busy} onClick={() => void finish(false)}>{o.enterLater}</button>}
        {step < 2
          ? <button className={"btn-primary " + WIZARD_PRIMARY} disabled={!plan || busy || (step === 1 && (teamInvalid || balanceInvalid))} onClick={next}>
            {(step === 1 || plan === "none") && keyConfigured ? o.done : <>{o.next} <ArrowRight size={14} /></>}</button>
          : <button className={"btn-primary " + WIZARD_PRIMARY} disabled={!apiKey.trim() || busy} onClick={() => void finish(true)}>{o.saveAndStart}</button>}
      </footer>
    </div>
  </div>;
}
