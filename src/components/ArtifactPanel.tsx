import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { CopyButton, Markdown } from "./MessageContent";
import { KIND_EXT, KIND_LABEL, type ArtifactRequest } from "../lib/artifacts";

// The preview runs in an opaque-origin sandbox: scripts may run, but there is no access to the app,
// its storage, or the network.
const CSP = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:";

export function previewDocument(artifact: { language: "html" | "svg"; code: string }): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  if (artifact.language === "svg") {
    return `<!doctype html><html><head>${meta}<style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#fff}svg{max-width:100%;max-height:100%}</style></head><body>${artifact.code}</body></html>`;
  }
  return /<head[\s>]/i.test(artifact.code)
    ? artifact.code.replace(/<head([^>]*)>/i, `<head$1>${meta}`)
    : `<!doctype html><html><head>${meta}</head><body>${artifact.code}</body></html>`;
}

let mermaidSeq = 0;
/** Renders a Mermaid diagram to SVG text (strict mode: no scripts or HTML labels); the SVG is then shown sandboxed. */
async function renderMermaid(code: string): Promise<string> {
  const { default: mermaid } = await import("mermaid");
  // Plain SVG text (no HTML labels): the sandboxed frame may lay out fonts differently, which clips HTML labels.
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default", htmlLabels: false, flowchart: { htmlLabels: false }, fontFamily: "sans-serif" });
  const { svg } = await mermaid.render(`mmd-${++mermaidSeq}`, code);
  return svg;
}

function MermaidPreview({ artifact }: { artifact: ArtifactRequest }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setSvg(null); setError("");
    renderMermaid(artifact.code).then(s => { if (alive) setSvg(s); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [artifact.code]);
  if (error) return <div className="artifact-error"><b>図を描けませんでした</b><pre>{error}</pre></div>;
  if (!svg) return <div className="artifact-loading">図を描いています…</div>;
  return <iframe className="artifact-frame" title={artifact.title} sandbox="" srcDoc={previewDocument({ language: "svg", code: svg })} />;
}

type Props = { artifact: ArtifactRequest; versions: ArtifactRequest[]; onSelect: (artifact: ArtifactRequest) => void; onClose: () => void };

export default function ArtifactPanel({ artifact, versions, onSelect, onClose }: Props) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const index = Math.max(0, versions.findIndex(v => v.code === artifact.code));
  function download() {
    const type = { html: "text/html", svg: "image/svg+xml", markdown: "text/markdown", mermaid: "text/plain" }[artifact.language];
    const url = URL.createObjectURL(new Blob([artifact.code], { type }));
    const link = document.createElement("a");
    const base = artifact.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "artifact";
    link.href = url; link.download = `${base}.${KIND_EXT[artifact.language]}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <aside className="artifact-panel" aria-label="アーティファクト">
    <header>
      <b>{artifact.title}</b><small>{KIND_LABEL[artifact.language]}</small>
      {versions.length > 1 && <span className="alt-switch artifact-versions" aria-label="バージョン">
        <button className="icon-action" disabled={index === 0} onClick={() => onSelect(versions[index - 1])} aria-label="前のバージョン"><ChevronLeft size={15} /></button>
        v{index + 1} / {versions.length}
        <button className="icon-action" disabled={index >= versions.length - 1} onClick={() => onSelect(versions[index + 1])} aria-label="次のバージョン"><ChevronRight size={15} /></button>
      </span>}
      <span className="spacer" />
      <div className="segmented small" role="tablist">
        <button role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>プレビュー</button>
        <button role="tab" aria-selected={tab === "code"} className={tab === "code" ? "active" : ""} onClick={() => setTab("code")}>コード</button>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="閉じる"><X size={16} /></button>
    </header>
    {tab === "code"
      ? <pre className="artifact-code">{artifact.code}</pre>
      : artifact.language === "markdown"
        ? <div className="artifact-doc"><Markdown text={artifact.code} /></div>
        : artifact.language === "mermaid"
          ? <MermaidPreview artifact={artifact} />
          : <iframe className="artifact-frame" title={artifact.title} sandbox="allow-scripts" srcDoc={previewDocument({ language: artifact.language, code: artifact.code })} />}
    {(artifact.language === "html" || artifact.language === "svg" || artifact.language === "mermaid") && <p className="hint">sandbox 付き iframe で表示しています（ネットワーク・アプリ本体へのアクセスなし）</p>}
    <div className="artifact-actions">
      <button className="btn-secondary" onClick={download}><Download size={14} /> .{KIND_EXT[artifact.language]} で保存</button>
      <CopyButton text={artifact.code} />
    </div>
  </aside>;
}
