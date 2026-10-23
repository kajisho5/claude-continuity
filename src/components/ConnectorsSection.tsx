import { useEffect, useState } from "react";
import { joinArgs, type ConnectorView } from "../lib/connectors";
import { CircleCheck, Download, Plug, Plus, RefreshCw, SquareTerminal, Trash2 } from "lucide-react";
import { useT } from "../i18n";

type Draft = {
  id?: string; transport: "remote" | "local"; name: string;
  url: string; token: string; keepToken: boolean;
  command: string; args: string; env: string; keepEnv: boolean; envKeys: string[];
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const EMPTY: Draft = { transport: "remote", name: "", url: "", token: "", keepToken: false, command: "", args: "", env: "", keepEnv: false, envKeys: [] };

const CONNECTOR_ROW = "flex gap-[10px] rounded-[10px] border border-line px-[12px] py-[10px]";
const CONNECTOR_SMALL = "overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-subtle";

/**
 * MCP servers Claude can use: remote ones through the API's MCP connector, local (stdio) ones started on this PC.
 * Tokens and environment variables are stored encrypted and never shown again.
 */
export default function ConnectorsSection({ onChange }: { onChange: (list: ConnectorView[]) => void }) {
  const t = useT();
  const cx = t.settings.connectors;
  const [list, setList] = useState<ConnectorView[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [test, setTest] = useState<Record<string, { ok: boolean; text: string }>>({});
  useEffect(() => { window.continuity.listConnectors().then(setList).catch(() => setList([])); }, []);
  const update = (next: ConnectorView[]) => { setList(next); onChange(next); };
  async function save() {
    if (!draft) return;
    setError("");
    try {
      update(await window.continuity.saveConnector(draft.transport === "local"
        ? { id: draft.id, transport: "local", name: draft.name, command: draft.command, args: draft.args, ...(draft.keepEnv ? {} : { env: draft.env }) }
        : { id: draft.id, transport: "remote", name: draft.name, url: draft.url, ...(draft.keepToken ? {} : { token: draft.token }) }));
      setDraft(null);
    } catch (e) { setError(message(e)); }
  }
  async function runTest(id: string) {
    setTest(s => ({ ...s, [id]: { ok: false, text: cx.testing } }));
    try { const { tools } = await window.continuity.testConnector(id); setTest(s => ({ ...s, [id]: { ok: true, text: cx.testResult(tools.length, tools.slice(0, 6).join(", "), tools.length > 6) } })); }
    catch (e) { setTest(s => ({ ...s, [id]: { ok: false, text: message(e) } })); }
  }
  async function importDesktop() {
    setNotice(""); setError("");
    try { const r = await window.continuity.importDesktopConnectors(); update(r.list); setNotice(cx.imported(r.added, r.found)); }
    catch (e) { setNotice(message(e)); }
  }
  const edit = (c: ConnectorView) => setDraft({ ...EMPTY, id: c.id, transport: c.transport, name: c.name, url: c.url, keepToken: true, command: c.command ?? "", args: joinArgs(c.args ?? []), keepEnv: !!c.envKeys?.length, envKeys: c.envKeys ?? [] });
  const detail = (c: ConnectorView) => c.transport === "local"
    ? `${[c.command ?? "", joinArgs(c.args ?? [])].filter(Boolean).join(" ")}${c.envKeys?.length ? cx.envCount(c.envKeys.length) : ""}`
    : `${c.url}${c.hasToken ? cx.hasToken : ""}`;
  return <section className="credit-form">
    <h3 className="m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">{cx.heading}</h3>
    <p className="muted">{cx.intro}</p>
    <ul className="hint-list m-[8px_0_0] flex flex-col gap-[4px] pl-[18px] text-[11px] leading-[1.6] text-subtle">
      {cx.notes.map(note => <li key={note}>{note}</li>)}
    </ul>
    {list === null ? <p className="hint">{t.common.loading}</p> : <ul className="connector-list m-[14px_0_0] flex list-none flex-col gap-[6px] p-0">
      {list.map(c => <li key={c.id} className={CONNECTOR_ROW + " items-center bg-inset"}>
        {c.transport === "local" ? <SquareTerminal size={16} className="shrink-0 text-muted" /> : <Plug size={16} className="shrink-0 text-muted" />}
        <span className="connector-text flex min-w-0 flex-1 flex-col gap-[2px]">
          <b className="flex items-center gap-[6px] text-[13px] text-ink-2">{c.name}{c.transport === "local" && <span className="local-badge rounded-[5px] bg-line px-[5px] py-[1px] text-[10px] font-medium text-muted">{cx.localBadge}</span>}</b>
          <small className={CONNECTOR_SMALL} title={detail(c)}>{detail(c)}</small>
          {!!c.allowedTools?.length && <small className={CONNECTOR_SMALL + " allowed inline-flex items-center gap-[6px]"}>{cx.allowedCount(c.allowedTools.length)}<button className="link-btn border-0 bg-transparent p-0 text-[11px] text-link underline" onClick={() => void window.continuity.resetAllowedTools(c.id).then(update)}>{cx.resetAllowed}</button></small>}
          {test[c.id] && <small className={CONNECTOR_SMALL + (test[c.id].ok ? " ok inline-flex items-center gap-[4px] text-ok" : " whitespace-pre-wrap")}>{test[c.id].ok && <CircleCheck size={11} />} {test[c.id].text}</small>}
        </span>
        <button className="btn-secondary small" onClick={() => void runTest(c.id)}><RefreshCw size={12} />{cx.test}</button>
        <button className="btn-text" onClick={() => edit(c)}>{t.common.edit}</button>
        <button className="icon-btn" aria-label={cx.remove(c.name)} onClick={() => { if (window.confirm(cx.confirmDelete(c.name))) void window.continuity.deleteConnector(c.id).then(update); }}><Trash2 size={14} /></button>
      </li>)}
      {list.length === 0 && !draft && <li className={"empty " + CONNECTOR_ROW + " justify-center border-dashed bg-transparent text-center text-[12px] text-subtle"}>{cx.empty}</li>}
    </ul>}
    {draft
      ? <div className="connector-form mt-[12px] rounded-[12px] border border-line-strong px-[14px] py-[12px]">
        {!draft.id && <div className="segmented small mb-[4px] self-start" role="tablist" aria-label={cx.heading}>
          <button role="tab" aria-selected={draft.transport === "remote"} className={draft.transport === "remote" ? "active" : ""} onClick={() => setDraft({ ...draft, transport: "remote" })}>{cx.transportRemote}</button>
          <button role="tab" aria-selected={draft.transport === "local"} className={draft.transport === "local" ? "active" : ""} onClick={() => setDraft({ ...draft, transport: "local" })}>{cx.transportLocal}</button>
        </div>}
        <label className="field"><span>{cx.name}</span><input className="text-input" value={draft.name} maxLength={60} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder={draft.transport === "local" ? "filesystem" : cx.namePlaceholder} /></label>
        {draft.transport === "local" ? <>
          <label className="field"><span>{cx.command}</span><input className="text-input font-mono" value={draft.command} onChange={e => setDraft({ ...draft, command: e.target.value })} placeholder={cx.commandPlaceholder} spellCheck={false} /></label>
          <label className="field"><span>{cx.args}<small>{cx.argsHint}</small></span><input className="text-input font-mono" value={draft.args} onChange={e => setDraft({ ...draft, args: e.target.value })} placeholder="-y @modelcontextprotocol/server-filesystem C:\Users\me\Documents" spellCheck={false} /></label>
          <label className="field"><span>{cx.env}</span>
            {draft.id && draft.keepEnv
              ? <div className="key-row mt-[12px] flex gap-[8px]"><input className="text-input" disabled value={cx.keepEnv(draft.envKeys.join(", "))} /><button className="btn-secondary whitespace-nowrap" onClick={() => setDraft({ ...draft, keepEnv: false })}>{cx.change}</button></div>
              : <textarea className="text-input min-h-[64px] font-mono" value={draft.env} onChange={e => setDraft({ ...draft, env: e.target.value })} placeholder={cx.envPlaceholder} spellCheck={false} autoComplete="off" />}</label>
        </> : <>
          <label className="field"><span>{cx.url}</span><input className="text-input" value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="https://mcp.example.com/mcp" /></label>
          <label className="field"><span>{cx.token}</span>
            {draft.id && draft.keepToken
              ? <div className="key-row mt-[12px] flex gap-[8px]"><input className="text-input" disabled value={cx.keepToken} /><button className="btn-secondary whitespace-nowrap" onClick={() => setDraft({ ...draft, keepToken: false })}>{cx.change}</button></div>
              : <input className="text-input" type="password" value={draft.token} onChange={e => setDraft({ ...draft, token: e.target.value })} placeholder={cx.tokenPlaceholder} autoComplete="off" />}</label>
        </>}
        {error && <p className="form-message error text-danger">{error}</p>}
        <div className="form-actions"><button className="btn-secondary" onClick={() => { setDraft(null); setError(""); }}>{t.common.cancel}</button><button className="btn-primary" disabled={!draft.name.trim() || !(draft.transport === "local" ? draft.command.trim() : draft.url.trim())} onClick={() => void save()}>{t.common.save}</button></div>
      </div>
      : <div className="form-actions start"><button className="btn-secondary small" onClick={() => { setNotice(""); setDraft({ ...EMPTY }); }}><Plus size={13} />{cx.add}</button><button className="btn-secondary small import-desktop" onClick={() => void importDesktop()}><Download size={13} />{cx.importDesktop}</button></div>}
    {notice && <p className="form-message import-notice whitespace-pre-wrap text-[12px] text-muted">{notice}</p>}
  </section>;
}
