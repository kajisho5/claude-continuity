import { useState } from "react";
import { PLAN_PRESETS, cycleRange, formatShortDate, type CreditSettings, type PlanId } from "../lib/credit";
import { formatUsd } from "../lib/pricing";
import { intlLocale, useT, type Messages } from "../i18n";

type Props = { value: CreditSettings | null; onSave: (next: CreditSettings) => Promise<void> };
const SEGMENTS: PlanId[] = ["max5x", "max20x", "team", "custom", "none"];
const segmentLabels = (t: Messages): Record<PlanId, string> => ({ max5x: "Max 5x · $100", max20x: "Max 20x · $200", team: "Team", custom: t.credit.form.custom, none: t.credit.form.none });

export default function CreditSettingsForm({ value, onSave }: Props) {
  const t = useT();
  const f = t.credit.form;
  const [plan, setPlan] = useState<PlanId>(value?.plan ?? "max20x");
  const [customAmount, setCustomAmount] = useState(value && (value.plan === "team" || value.plan === "custom") ? String(value.monthlyAmountUsd) : "");
  const [resetDay, setResetDay] = useState(value?.resetDay ?? new Date().getDate());
  const [balance, setBalance] = useState("");
  const [calibration, setCalibration] = useState(value?.calibration);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const preset = plan === "max5x" || plan === "max20x" || plan === "none";
  const amount = preset ? PLAN_PRESETS[plan as "max5x" | "max20x" | "none"] : Number(customAmount);
  const amountInvalid = !preset && !(amount > 0 && amount <= 10000);
  const { start, end } = cycleRange(resetDay, new Date());
  const calibrationActive = calibration && new Date(calibration.observedAt) >= start;

  function recordBalance() {
    const parsed = Number(balance);
    if (!(Number.isFinite(parsed) && parsed >= 0) || balance.trim() === "") { setMessage(f.balanceInvalid); return; }
    setCalibration({ balanceUsd: parsed, observedAt: new Date().toISOString() });
    setBalance("");
    setMessage(f.balanceRecorded);
  }
  async function save() {
    setSaving(true); setMessage("");
    try {
      await onSave({ plan, monthlyAmountUsd: plan === "none" ? 0 : amount, resetDay, onboardingDone: true, ...(calibration ? { calibration } : {}) });
      setMessage(f.saved);
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return <section className="credit-form">
    <h3 className="m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">{f.heading}</h3>
    <p className="muted">{f.intro}</p>
    <span className="field-label mt-[16px] block text-[11px] font-semibold text-ink-2">{f.plan}</span>
    <div className="segmented" role="radiogroup" aria-label={f.plan}>
      {SEGMENTS.map(id => <button key={id} type="button" role="radio" aria-checked={plan === id}
        className={plan === id ? "active" : ""} onClick={() => setPlan(id)}>{segmentLabels(t)[id]}</button>)}
    </div>
    <div className="field-row flex gap-[14px]">
      <label className="field"><span>{f.monthlyAmount}</span>
        {preset
          ? <span className="text-input readonly flex items-center justify-between border-line text-muted">{formatUsd(amount)}<small className="text-[9px] text-faint">{plan === "none" ? f.noGrant : f.preset}</small></span>
          : <input className={"text-input" + (amountInvalid && customAmount ? " invalid border-danger" : "")} inputMode="decimal" value={customAmount}
            onChange={e => setCustomAmount(e.target.value)} placeholder={plan === "team" ? f.teamPlaceholder : f.customPlaceholder} />}
      </label>
      <label className="field"><span>{f.resetDay}</span>
        <span className="day-input flex items-center gap-[8px] rounded-[8px] border border-line-input bg-inset px-[12px] py-[6px] text-[13px] text-muted">{t.credit.dayBefore}
          <select className="rounded-[6px] border border-line-input bg-surface-2 px-[8px] py-[5px] text-[14px] font-bold text-ink" value={resetDay} onChange={e => setResetDay(Number(e.target.value))} aria-label={t.credit.dayLabel}>
            {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>{t.credit.dayAfter}</span>
      </label>
    </div>
    <p className="hint">{f.cycleHint(formatShortDate(start), formatShortDate(end))}</p>
    {plan !== "none" && <div className="calibration mt-[14px] rounded-[10px] border border-line bg-inset px-[14px] py-[13px] text-[11px]">
      <b>{f.calibrate}</b>
      <p className="m-[5px_0_10px] text-[10px] leading-[1.6] text-muted">{t.credit.calibrationIntro}</p>
      <div className="key-row mt-[12px] flex gap-[8px]">
        <input className="text-input" inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} placeholder={f.balancePlaceholder} />
        <button className="btn-secondary whitespace-nowrap" onClick={recordBalance}>{f.recordBalance}</button>
      </div>
      {calibration && <small className="mt-[8px] block text-[9px] text-faint">{f.lastCalibration}{new Date(calibration.observedAt).toLocaleString(intlLocale())} · {formatUsd(calibration.balanceUsd)}
        {calibrationActive ? f.calibrationActive : f.calibrationStale}
        <button className="link" onClick={() => setCalibration(undefined)}>{f.clear}</button></small>}
    </div>}
    <div className="form-actions">
      {message && <span className="form-message">{message}</span>}
      <button className="btn-primary" disabled={saving || amountInvalid} onClick={() => void save()}>{f.save}</button>
    </div>
  </section>;
}
