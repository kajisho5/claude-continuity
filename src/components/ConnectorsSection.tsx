import { useEffect, useState } from "react";
import type { ConnectorView } from "../lib/connectors";
import { CircleCheck, Plug, Plus, RefreshCw, Trash2 } from "lucide-react";

type Draft = { id?: string; name: string; url: string; token: string; keepToken: boolean };
const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

const CONNECTOR_ROW = "flex gap-[10px] rounded-[10px] border border-line px-[12px] py-[10px]";
const CONNECTOR_SMALL = "overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-subtle";

/** Remote MCP servers Claude can use through the API's MCP connector. Tokens are stored encrypted and never shown again. */
export default function ConnectorsSection({ onChange }: { onChange: (list: ConnectorView[]) => void }) {
  const [list, setList] = useState<ConnectorView[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [test, setTest] = useState<Record<string, string>>({});
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
    setTest(t => ({ ...t, [id]: "確認しています…" }));
    try { const { tools } = await window.continuity.testConnector(id); setTest(t => ({ ...t, [id]: `接続できました · ツール ${tools.length} 個${tools.length ? `（${tools.slice(0, 6).join(", ")}${tools.length > 6 ? " ほか" : ""}）` : ""}` })); }
    catch (e) { setTest(t => ({ ...t, [id]: message(e) })); }
  }
  return <section className="credit-form">
    <h3 className="m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">コネクタ</h3>
    <p className="muted">リモートの MCP サーバー（Notion・Asana・社内ツールなど）を登録すると、会話ごとに「ツール」メニューからオンにして Claude に使わせられます。Anthropic の API が登録先のサーバーへ直接接続します。</p>
    <ul className="hint-list m-[8px_0_0] flex flex-col gap-[4px] pl-[18px] text-[11px] leading-[1.6] text-subtle">
      <li>使えるのは https:// で公開された MCP サーバー（Streamable HTTP / SSE）だけです。PC 内で動く MCP サーバーはこの方式では使えません。</li>
      <li>OAuth が必要なサーバーは、取得したアクセストークンを貼り付けてください（期限が切れたら貼り直しが必要です）。トークンは OS の安全な保存領域で暗号化して保存します。</li>
      <li>この機能はベータ版で、やり取りした内容は Anthropic の標準のデータ保持ポリシーに従って保存されます（ゼロデータ保持の対象外）。</li>
    </ul>
    {list === null ? <p className="hint">読み込み中…</p> : <ul className="connector-list m-[14px_0_0] flex list-none flex-col gap-[6px] p-0">
      {list.map(c => <li key={c.id} className={CONNECTOR_ROW + " items-center bg-inset"}>
        <Plug size={16} className="shrink-0 text-muted" />
        <span className="connector-text flex min-w-0 flex-1 flex-col gap-[2px]"><b className="text-[13px] text-ink-2">{c.name}</b><small className={CONNECTOR_SMALL}>{c.url}{c.hasToken ? " · トークンあり" : ""}</small>{test[c.id] && <small className={CONNECTOR_SMALL + (test[c.id].startsWith("接続できました") ? " ok inline-flex items-center gap-[4px] text-ok" : "")}>{test[c.id].startsWith("接続できました") && <CircleCheck size={11} />} {test[c.id]}</small>}</span>
        <button className="btn-secondary small" onClick={() => void runTest(c.id)}><RefreshCw size={12} />接続テスト</button>
        <button className="btn-text" onClick={() => setDraft({ id: c.id, name: c.name, url: c.url, token: "", keepToken: true })}>編集</button>
        <button className="icon-btn" aria-label={`${c.name} を削除`} onClick={() => { if (window.confirm(`${c.name} を削除しますか？`)) void window.continuity.deleteConnector(c.id).then(update); }}><Trash2 size={14} /></button>
      </li>)}
      {list.length === 0 && !draft && <li className={"empty " + CONNECTOR_ROW + " h-full min-h-[350px] flex-col items-center justify-center border-dashed bg-transparent text-center text-[12px] text-subtle"}>まだコネクタはありません。</li>}
    </ul>}
    {draft
      ? <div className="connector-form mt-[12px] rounded-[12px] border border-line-strong px-[14px] py-[12px]">
        <label className="field"><span>名前</span><input className="text-input" value={draft.name} maxLength={60} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="例: Notion" /></label>
        <label className="field"><span>サーバーの URL</span><input className="text-input" value={draft.url} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="https://mcp.example.com/mcp" /></label>
        <label className="field"><span>アクセストークン（任意）</span>
          {draft.id && draft.keepToken
            ? <div className="key-row mt-[12px] flex gap-[8px]"><input className="text-input" disabled value="（保存済みのトークンを使う）" /><button className="btn-secondary whitespace-nowrap" onClick={() => setDraft({ ...draft, keepToken: false })}>変更</button></div>
            : <input className="text-input" type="password" value={draft.token} onChange={e => setDraft({ ...draft, token: e.target.value })} placeholder="空欄ならトークンなしで接続" autoComplete="off" />}</label>
        {error && <p className="form-message error text-danger">{error}</p>}
        <div className="form-actions"><button className="btn-secondary" onClick={() => { setDraft(null); setError(""); }}>キャンセル</button><button className="btn-primary" disabled={!draft.name.trim() || !draft.url.trim()} onClick={() => void save()}>保存</button></div>
      </div>
      : <div className="form-actions start"><button className="btn-secondary small" onClick={() => setDraft({ name: "", url: "", token: "", keepToken: false })}><Plus size={13} />コネクタを追加</button></div>}
  </section>;
}
