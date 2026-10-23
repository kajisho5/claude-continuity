import { useEffect, useState } from "react";
import type { ConnectorView } from "../lib/connectors";
import { CircleCheck, Plug, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useT } from "../i18n";

type Draft = { id?: string; name: string; url: string; token: string; keepToken: boolean };
const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

const CONNECTOR_ROW = "flex gap-[10px] rounded-[10px] border border-line px-[12px] py-[10px]";
const CONNECTOR_SMALL = "overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-subtle";

/** Remote MCP servers Claude can use through the API's MCP connector. Tokens are stored encrypted and never shown again. */
export default function ConnectorsSection({ onChange }: { onChange: (list: ConnectorView[]) => void }) {
  const t = useT();
  const cx = t.settings.connectors;
  const [list, setList] = useState<ConnectorView[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [test, setTest] = useState<Record<string, { ok: boolean; text: string }>>({});
  useEffect(() => { window.continuity.listConnectors().then(setList).catch(() => setList([])); }, []);
  const update = (next: ConnectorView[]) => { setList(next); onChange(next); };
  async function save() {
    if (!draft) return;
    setError("");
    try {
      update(await window.continuity.saveConnector({ id: draft.id, name: draft.name, url: draft.url, ...(draft.keepToken ? {} : { token: draft.token }) }));
      setDraft(null);
    } catch (e) { setError(message(e)); }
  }
  async function runTest(id: string) {
    setTest(s => ({ ...s, [id]: { ok: false, text: cx.testing } }));
    try { const { tools } = await window.continuity.testConnector(id); setTest(s => ({ ...s, [id]: { ok: true, text: cx.testResult(tools.length, tools.slice(0, 6).join(", "), tools.length > 6) } })); }
    catch (e) { setTest(s => ({ ...s, [id]: { ok: false, text: message(e) } })); }
  }
  return <section className="credit-form">
    <h3 className="m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">{cx.heading}</h3>
    <p className="muted">{cx.intro}</p>
    <ul className="hint-list m-[8px_0_0] flex flex-col gap-[4px] pl-[18px] text-[11px] leading-[1.6] text-subtle">
      {cx.notes.map(note => <li key={note}>{note}</li>)}
    </ul>
    {list === null ? <p className="hint">{t.common.loading}</p> : <ul className="connector-list m-[14px_0_0] flex list-none flex-col gap-[6px] p-0">
      {list.map(c => <li key={c.id} className={CONNECTOR_ROW + " items-center bg-inset"}>
        <Plug size={16} className="shrink-0 text-muted" />
        <span className="connector-text flex min-w-0 flex-1 flex-col gap-[2px]"><b className="text-[13px] text-ink-2">{c.name}</b><small className={CONNECTOR_SMALL}>{c.url}{c.hasToken ? cx.hasToken : ""}</small>{test[c.id] && <small className={CONNECTOR_SMALL + (test[c.id].ok ? " ok inline-flex items-center gap-[4px] text-ok" : "")}>{test[c.id].ok && <CircleCheck size={11} />} {test[c.id].text}</small>}</span>
        <button className="btn-secondary small" onClick={() => void runTest(c.id)}><RefreshCw size={12} />{cx.test}</button>
        <button className="btn-text" onClick={() => setDraft({ id: c.id, name: c.name, url: c.url, token: "", keepToken: true })}>{t.common.edit}</button>
        <button className="icon-btn" aria-label={cx.remove(c.name)} onClick={() => { if (window.confirm(cx.confirmDelete(c.name))) void window.continuity.deleteConnector(c.id).then(update); }}><Trash2 size={14} /></button>
      </li>)}
      {list.length === 0 && !draft && <li className={"empty " + CONNECTOR_ROW + " justify-center border-dashed bg-transparent text-center text-[12px] text-subtle"}>{cx.empty}</li>}
    </ul>}
    {draft
      ? <div className="connector-form mt-[12px] rounded-[12px] border border-line-strong px-[14px] py-[12px]">
        <label className="field"><span>{cx.name}</span><input className="text-input" value={draft.name} maxLength={60} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder={cx.namePlaceholder} /></label>
        <label className="field"><span>{cx.url}</span><input className="text-input" value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="https://mcp.example.com/mcp" /></label>
        <label className="field"><span>{cx.token}</span>
          {draft.id && draft.keepToken
            ? <div className="key-row mt-[12px] flex gap-[8px]"><input className="text-input" disabled value={cx.keepToken} /><button className="btn-secondary whitespace-nowrap" onClick={() => setDraft({ ...draft, keepToken: false })}>{cx.change}</button></div>
            : <input className="text-input" type="password" value={draft.token} onChange={e => setDraft({ ...draft, token: e.target.value })} placeholder={cx.tokenPlaceholder} autoComplete="off" />}</label>
        {error && <p className="form-message error text-danger">{error}</p>}
        <div className="form-actions"><button className="btn-secondary" onClick={() => { setDraft(null); setError(""); }}>{t.common.cancel}</button><button className="btn-primary" disabled={!draft.name.trim() || !draft.url.trim()} onClick={() => void save()}>{t.common.save}</button></div>
      </div>
      : <div className="form-actions start"><button className="btn-secondary small" onClick={() => setDraft({ name: "", url: "", token: "", keepToken: false })}><Plus size={13} />{cx.add}</button></div>}
  </section>;
}
