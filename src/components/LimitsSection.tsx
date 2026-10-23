import { useState } from "react";
import { parseAmount } from "../lib/credit";
import type { Prefs } from "../lib/prefs";
import { useT } from "../i18n";

const amountText = (v: number | null) => v == null ? "" : String(v);
/** "" means no limit; anything else must be a positive amount up to $10,000. */
function parseLimit(text: string): number | null | undefined {
  if (!text.trim()) return null;
  const n = parseAmount(text);
  return Number.isFinite(n) && n > 0 && n <= 10000 ? n : undefined;
}

/** Settings → Credit: limits checked against the estimate before a message is sent. */
export default function LimitsSection({ prefs, onSave }: { prefs: Prefs; onSave: (change: (current: Prefs) => Prefs) => Promise<void> }) {
  const t = useT();
  const l = t.spend.limits;
  const [perMessage, setPerMessage] = useState(amountText(prefs.limitPerMessageUsd));
  const [daily, setDaily] = useState(amountText(prefs.limitDailyUsd));
  const [mode, setMode] = useState(prefs.limitMode);
  const [message, setMessage] = useState("");
  const per = parseLimit(perMessage), day = parseLimit(daily);
  const invalid = per === undefined || day === undefined;
  async function save() {
    if (invalid) { setMessage(l.invalid); return; }
    await onSave(current => ({ ...current, limitPerMessageUsd: per, limitDailyUsd: day, limitMode: mode }));
    setMessage(l.saved);
  }
  const field = (label: string, value: string, set: (v: string) => void, cls: string) => <label className={"field limit-field " + cls}><span>{label}</span>
    <span className="flex items-center gap-[10px]"><input className={"text-input max-w-[160px]" + (parseLimit(value) === undefined ? " invalid border-danger" : "")} inputMode="decimal" value={value} placeholder="$" onChange={e => set(e.target.value)} />
      <small className="text-[10.5px] text-faint">{l.emptyMeansNone}</small></span></label>;
  return <section className="limits-section mt-[26px] border-t border-line pt-[20px]">
    <h3 className="m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">{l.heading}</h3>
    <p className="muted">{l.intro}</p>
    {field(l.perMessage, perMessage, setPerMessage, "limit-per-message")}
    {field(l.daily, daily, setDaily, "limit-daily")}
    <span className="field-label mt-[14px] block text-[11px] font-semibold text-ink-2">{l.mode}</span>
    <div className="segmented limit-mode" role="radiogroup" aria-label={l.mode}>
      {(["confirm", "block"] as const).map(m => <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>{l[m]}</button>)}
    </div>
    <div className="form-actions">{message && <span className="form-message">{message}</span>}
      <button className="btn-primary limits-save" disabled={invalid} onClick={() => void save()}>{l.save}</button></div>
  </section>;
}

/** Settings → Styles & memory: summarize older turns of long chats instead of dropping them. */
export function LongChatsSection({ prefs, onSave }: { prefs: Prefs; onSave: (change: (current: Prefs) => Prefs) => Promise<void> }) {
  const t = useT();
  const l = t.spend.longChats;
  return <section className="long-chats mt-[26px] border-t border-line pt-[20px]">
    <h3 className="m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">{l.heading}</h3>
    <p className="muted">{l.intro}</p>
    <label className="toggle-row compact-toggle mt-[12px] flex items-center justify-between gap-[16px] text-[13px] text-ink-2">{l.toggle}
      <input type="checkbox" className="switch" checked={prefs.compactLongChats} onChange={e => { const on = e.target.checked; void onSave(current => ({ ...current, compactLongChats: on })); }} /></label>
    <p className="hint">{l.note}</p>
  </section>;
}
