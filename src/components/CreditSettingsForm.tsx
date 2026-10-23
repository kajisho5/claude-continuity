import { useState } from "react";
import { PLAN_PRESETS, cycleRange, formatShortDate, type CreditSettings, type PlanId } from "../lib/credit";
import { formatUsd } from "../lib/pricing";

type Props = { value: CreditSettings | null; onSave: (next: CreditSettings) => Promise<void> };
const SEGMENTS: PlanId[] = ["max5x", "max20x", "team", "custom", "none"];
const SEGMENT_LABELS: Record<PlanId, string> = { max5x: "Max 5x · $100", max20x: "Max 20x · $200", team: "Team", custom: "カスタム", none: "対象外" };

export default function CreditSettingsForm({ value, onSave }: Props) {
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
    if (!(Number.isFinite(parsed) && parsed >= 0) || balance.trim() === "") { setMessage("残額は 0 以上の数値で入力してください。"); return; }
    setCalibration({ balanceUsd: parsed, observedAt: new Date().toISOString() });
    setBalance("");
    setMessage("残額を記録しました。「クレジット設定を保存」で確定します。");
  }
  async function save() {
    setSaving(true); setMessage("");
    try {
      await onSave({ plan, monthlyAmountUsd: plan === "none" ? 0 : amount, resetDay, onboardingDone: true, ...(calibration ? { calibration } : {}) });
      setMessage("クレジット設定を保存しました。");
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return <section className="credit-form">
    <h3>月間クレジット</h3>
    <p className="muted">毎月付与されるAPIクレジットの消化状況を、この端末の利用記録から推定します。</p>
    <span className="field-label">プラン</span>
    <div className="segmented" role="radiogroup" aria-label="プラン">
      {SEGMENTS.map(id => <button key={id} type="button" role="radio" aria-checked={plan === id}
        className={plan === id ? "active" : ""} onClick={() => setPlan(id)}>{SEGMENT_LABELS[id]}</button>)}
    </div>
    <div className="field-row">
      <label className="field"><span>月間付与額（USD）</span>
        {preset
          ? <span className="text-input readonly">{formatUsd(amount)}<small>{plan === "none" ? "付与なし" : "プリセット"}</small></span>
          : <input className={"text-input" + (amountInvalid && customAmount ? " invalid" : "")} inputMode="decimal" value={customAmount}
            onChange={e => setCustomAmount(e.target.value)} placeholder={plan === "team" ? "チーム合計（上限 $500）" : "例: 150"} />}
      </label>
      <label className="field"><span>クレジット付与日</span>
        <span className="day-input">毎月
          <select value={resetDay} onChange={e => setResetDay(Number(e.target.value))} aria-label="付与日">
            {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>日</span>
      </label>
    </div>
    <p className="hint">Claudeの Settings › Billing に表示される請求日を入力してください。今のサイクル: {formatShortDate(start)} 〜 {formatShortDate(end)}（付与時刻は非公開のため日単位の目安）</p>
    {plan !== "none" && <div className="calibration">
      <b>Console残高で補正（任意）</b>
      <p>Console › Billing › Promotional credits の残額を入力すると、Playground など他の利用分も含めた推定になります。</p>
      <div className="key-row">
        <input className="text-input" inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} placeholder="$ 残額" />
        <button className="btn-secondary" onClick={recordBalance}>今の残高として記録</button>
      </div>
      {calibration && <small>最終補正: {new Date(calibration.observedAt).toLocaleString()} · {formatUsd(calibration.balanceUsd)}
        {calibrationActive ? "（今のサイクルで有効）" : "（前のサイクルのため無効）"}
        <button className="link" onClick={() => setCalibration(undefined)}>解除</button></small>}
    </div>}
    <div className="form-actions">
      {message && <span className="form-message">{message}</span>}
      <button className="btn-primary" disabled={saving || amountInvalid} onClick={() => void save()}>クレジット設定を保存</button>
    </div>
  </section>;
}
