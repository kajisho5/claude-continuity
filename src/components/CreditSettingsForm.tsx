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
    <h3 className="m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">月間クレジット</h3>
    <p className="muted">毎月付与されるAPIクレジットの消化状況を、この端末の利用記録から推定します。</p>
    <span className="field-label mt-[16px] block text-[11px] font-semibold text-ink-2">プラン</span>
    <div className="segmented" role="radiogroup" aria-label="プラン">
      {SEGMENTS.map(id => <button key={id} type="button" role="radio" aria-checked={plan === id}
        className={plan === id ? "active" : ""} onClick={() => setPlan(id)}>{SEGMENT_LABELS[id]}</button>)}
    </div>
    <div className="field-row flex gap-[14px]">
      <label className="field"><span>月間付与額（USD）</span>
        {preset
          ? <span className="text-input readonly flex items-center justify-between border-line text-muted">{formatUsd(amount)}<small className="text-[9px] text-faint">{plan === "none" ? "付与なし" : "プリセット"}</small></span>
          : <input className={"text-input" + (amountInvalid && customAmount ? " invalid border-danger" : "")} inputMode="decimal" value={customAmount}
            onChange={e => setCustomAmount(e.target.value)} placeholder={plan === "team" ? "チーム合計（上限 $500）" : "例: 150"} />}
      </label>
      <label className="field"><span>クレジット付与日</span>
        <span className="day-input flex items-center gap-[8px] rounded-[8px] border border-line-input bg-inset px-[12px] py-[6px] text-[13px] text-muted">毎月
          <select className="rounded-[6px] border border-line-input bg-surface-2 px-[8px] py-[5px] text-[14px] font-bold text-ink" value={resetDay} onChange={e => setResetDay(Number(e.target.value))} aria-label="付与日">
            {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>日</span>
      </label>
    </div>
    <p className="hint">Claudeの Settings › Billing に表示される請求日を入力してください。今のサイクル: {formatShortDate(start)} 〜 {formatShortDate(end)}（付与時刻は非公開のため日単位の目安）</p>
    {plan !== "none" && <div className="calibration mt-[14px] rounded-[10px] border border-line bg-inset px-[14px] py-[13px] text-[11px]">
      <b>Console残高で補正（任意）</b>
      <p className="m-[5px_0_10px] text-[10px] leading-[1.6] text-muted">Console › Billing › Promotional credits の残額を入力すると、Playground など他の利用分も含めた推定になります。</p>
      <div className="key-row mt-[12px] flex gap-[8px]">
        <input className="text-input" inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} placeholder="$ 残額" />
        <button className="btn-secondary whitespace-nowrap" onClick={recordBalance}>今の残高として記録</button>
      </div>
      {calibration && <small className="mt-[8px] block text-[9px] text-faint">最終補正: {new Date(calibration.observedAt).toLocaleString()} · {formatUsd(calibration.balanceUsd)}
        {calibrationActive ? "（今のサイクルで有効）" : "（前のサイクルのため無効）"}
        <button className="link" onClick={() => setCalibration(undefined)}>解除</button></small>}
    </div>}
    <div className="form-actions">
      {message && <span className="form-message">{message}</span>}
      <button className="btn-primary" disabled={saving || amountInvalid} onClick={() => void save()}>クレジット設定を保存</button>
    </div>
  </section>;
}
