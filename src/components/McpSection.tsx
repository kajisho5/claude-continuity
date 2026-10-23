import { useEffect, useState } from "react";
import { FolderPlus, X } from "lucide-react";
import { CopyButton } from "./MessageContent";

type Info = { serverPath: string; runtimePath: string; dataDir: string; platform: string };

/** Builds registration snippets for Claude Code and Claude Desktop. The API key is never filled in automatically. */
export function mcpSnippets(info: Info, roots: string[], model: string) {
  const delimiter = info.platform === "win32" ? ";" : ":";
  const env: Record<string, string> = {
    ANTHROPIC_API_KEY: "sk-ant-...（この用途専用のキー）",
    ELECTRON_RUN_AS_NODE: "1",
    CONTINUITY_DATA_DIR: info.dataDir,
    CONTINUITY_MCP_ROOTS: roots.join(delimiter),
    ...(model.trim() ? { CONTINUITY_MCP_MODEL: model.trim() } : {})
  };
  const q = (v: string) => `"${v.replace(/"/g, '\\"')}"`;
  const claudeCode = ["claude mcp add --transport stdio",
    ...Object.entries(env).map(([k, v]) => `  --env ${k}=${q(v)}`),
    `  --scope user continuity -- ${q(info.runtimePath)} ${q(info.serverPath)}`].join(info.platform === "win32" ? " `\n" : " \\\n");
  const desktop = JSON.stringify({ mcpServers: { continuity: { command: info.runtimePath, args: [info.serverPath], env } } }, null, 2);
  return { claudeCode, desktop };
}

export default function McpSection() {
  const [info, setInfo] = useState<Info | null>(null);
  const [roots, setRoots] = useState<string[]>([]);
  const [model, setModel] = useState("claude-opus-5-5");
  useEffect(() => { window.continuity.mcpInfo().then(setInfo).catch(() => setInfo(null)); }, []);
  if (!info) return null;
  const { claudeCode, desktop } = mcpSnippets(info, roots, model);
  return <section className="credit-form">
    <h3>MCP 連携（チャットから API に作業を任せる）</h3>
    <p className="muted">Claude Code や Claude Desktop から <code>delegate_task</code> を呼ぶと、重い資料の読み込みや長い推論を月間 API クレジットで処理し、要約だけを会話に返します。使った分は上のクレジット残額に合算されます。</p>
    <span className="field-label">読ませてよいフォルダ</span>
    <div className="knowledge-list">
      {roots.map(r => <span key={r} className="attachment-chip"><span className="attachment-text"><b>{r}</b></span>
        <button className="chip-remove" onClick={() => setRoots(list => list.filter(x => x !== r))} aria-label={`${r} を外す`}><X size={12} /></button></span>)}
      <button className="btn-secondary small" onClick={() => void window.continuity.pickMcpFolders().then(added => setRoots(list => [...new Set([...list, ...added])]))}><FolderPlus size={13} /> フォルダを追加</button>
    </div>
    <label className="field"><span>任せるときのモデル</span><input className="text-input" value={model} onChange={e => setModel(e.target.value)} /></label>
    <div className="snippet"><div className="snippet-head"><b>Claude Code に登録</b><CopyButton text={claudeCode} /></div><pre>{claudeCode}</pre></div>
    <div className="snippet"><div className="snippet-head"><b>Claude Desktop（claude_desktop_config.json）</b><CopyButton text={desktop} /></div><pre>{desktop}</pre></div>
    <p className="hint">キーは設定ファイルに平文で残るため、この用途専用のキーを作り、期限と支出上限のあるワークスペースに紐づけてください。1回あたりの費用上限は CONTINUITY_MCP_MAX_USD_PER_CALL（既定 $2）で変えられます。</p>
  </section>;
}
