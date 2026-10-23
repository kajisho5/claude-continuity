import { useEffect, useState } from "react";
import { FolderPlus, X } from "lucide-react";
import { CopyButton } from "./MessageContent";
import { getLocale, t as messages, useT, type Locale } from "../i18n";

type Info = { serverPath: string; runtimePath: string; dataDir: string; platform: string };

/** Builds registration snippets for Claude Code and Claude Desktop. The API key is never filled in automatically; CONTINUITY_MCP_LANG makes the server answer in the UI language. */
export function mcpSnippets(info: Info, roots: string[], model: string, locale: Locale = getLocale()) {
  const delimiter = info.platform === "win32" ? ";" : ":";
  const env: Record<string, string> = {
    ANTHROPIC_API_KEY: messages().settings.mcp.keyPlaceholder,
    ELECTRON_RUN_AS_NODE: "1",
    CONTINUITY_DATA_DIR: info.dataDir,
    CONTINUITY_MCP_ROOTS: roots.join(delimiter),
    ...(model.trim() ? { CONTINUITY_MCP_MODEL: model.trim() } : {}),
    CONTINUITY_MCP_LANG: locale
  };
  const q = (v: string) => `"${v.replace(/"/g, '\\"')}"`;
  const claudeCode = ["claude mcp add --transport stdio",
    ...Object.entries(env).map(([k, v]) => `  --env ${k}=${q(v)}`),
    `  --scope user continuity -- ${q(info.runtimePath)} ${q(info.serverPath)}`].join(info.platform === "win32" ? " `\n" : " \\\n");
  const desktop = JSON.stringify({ mcpServers: { continuity: { command: info.runtimePath, args: [info.serverPath], env } } }, null, 2);
  return { claudeCode, desktop };
}

const SNIPPET = "snippet mt-[12px] overflow-hidden rounded-[9px] border border-line bg-code";
const SNIPPET_HEAD = "snippet-head flex items-center justify-between bg-surface py-[6px] pr-[8px] pl-[12px] text-[10.5px]";
const SNIPPET_PRE = "m-0 max-h-[220px] overflow-auto px-[12px] py-[10px] font-mono text-[10px] leading-[1.6] font-normal break-all whitespace-pre-wrap text-ink-3 light:text-[#DAD6CC]";

export default function McpSection() {
  const t = useT();
  const m = t.settings.mcp;
  const [info, setInfo] = useState<Info | null>(null);
  const [roots, setRoots] = useState<string[]>([]);
  const [model, setModel] = useState("claude-opus-5-5");
  useEffect(() => { window.continuity.mcpInfo().then(setInfo).catch(() => setInfo(null)); }, []);
  if (!info) return null;
  const { claudeCode, desktop } = mcpSnippets(info, roots, model);
  return <section className="credit-form">
    <h3 className="m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">{m.heading}</h3>
    <p className="muted">{m.introBefore}<code className="rounded-[4px] bg-surface px-[.35em] py-[.05em] font-mono text-[.9em]">delegate_task</code>{m.introAfter}</p>
    <span className="field-label mt-[16px] block text-[11px] font-semibold text-ink-2">{m.folders}</span>
    <div className="knowledge-list flex flex-wrap items-center gap-[6px]">
      {roots.map(r => <span key={r} className="attachment-chip inline-flex max-w-[260px] animate-[popIn_.18s_var(--ease)_both] items-center gap-[8px] rounded-[9px] border border-line bg-surface py-[5px] pr-[8px] pl-[5px]"><span className="attachment-text flex min-w-0 flex-col"><b className="overflow-hidden text-[11px] font-medium text-ellipsis whitespace-nowrap text-ink-2">{r}</b></span>
        <button className="chip-remove border-0 bg-transparent px-[2px] py-0 text-[14px] text-muted" onClick={() => setRoots(list => list.filter(x => x !== r))} aria-label={m.removeFolder(r)}><X size={12} /></button></span>)}
      <button className="btn-secondary small" onClick={() => void window.continuity.pickMcpFolders().then(added => setRoots(list => [...new Set([...list, ...added])]))}><FolderPlus size={13} /> {m.addFolder}</button>
    </div>
    <label className="field"><span>{m.model}</span><input className="text-input" value={model} onChange={e => setModel(e.target.value)} /></label>
    <div className={SNIPPET}><div className={SNIPPET_HEAD}><b>{m.claudeCode}</b><CopyButton text={claudeCode} /></div><pre className={SNIPPET_PRE}>{claudeCode}</pre></div>
    <div className={SNIPPET}><div className={SNIPPET_HEAD}><b>{m.desktop}</b><CopyButton text={desktop} /></div><pre className={SNIPPET_PRE}>{desktop}</pre></div>
    <p className="hint">{m.hint}</p>
  </section>;
}
