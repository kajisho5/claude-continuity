import { useState } from "react";
import { Download, X } from "lucide-react";
import { CopyButton, type ArtifactRequest } from "./MessageContent";

// The preview runs in an opaque-origin sandbox: scripts may run, but there is no access to the app,
// its storage, or the network.
const CSP = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:";

export function previewDocument(artifact: ArtifactRequest): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  if (artifact.language === "svg") {
    return `<!doctype html><html><head>${meta}<style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#fff}svg{max-width:100%;max-height:100%}</style></head><body>${artifact.code}</body></html>`;
  }
  return /<head[\s>]/i.test(artifact.code)
    ? artifact.code.replace(/<head([^>]*)>/i, `<head$1>${meta}`)
    : `<!doctype html><html><head>${meta}</head><body>${artifact.code}</body></html>`;
}

export default function ArtifactPanel({ artifact, onClose }: { artifact: ArtifactRequest; onClose: () => void }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  function download() {
    const blob = new Blob([artifact.code], { type: artifact.language === "svg" ? "image/svg+xml" : "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = artifact.title; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <aside className="artifact-panel" aria-label="アーティファクト">
    <header>
      <b>{artifact.title}</b><small>アーティファクト</small>
      <div className="segmented small" role="tablist">
        <button role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>プレビュー</button>
        <button role="tab" aria-selected={tab === "code"} className={tab === "code" ? "active" : ""} onClick={() => setTab("code")}>コード</button>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="閉じる"><X size={16} /></button>
    </header>
    {tab === "preview"
      ? <iframe className="artifact-frame" title={artifact.title} sandbox="allow-scripts" srcDoc={previewDocument(artifact)} />
      : <pre className="artifact-code">{artifact.code}</pre>}
    <p className="hint">sandbox 付き iframe で表示しています（ネットワーク・アプリ本体へのアクセスなし）</p>
    <div className="artifact-actions">
      <button className="btn-secondary" onClick={download}><Download size={14} /> {artifact.language === "svg" ? "SVG" : "HTML"}を保存</button>
      <CopyButton text={artifact.code} />
    </div>
  </aside>;
}
