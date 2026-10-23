import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { CopyButton, Markdown } from "./MessageContent";
import { KIND_EXT, KIND_LABEL, type ArtifactRequest } from "../lib/artifacts";
import { useT } from "../i18n";
import { getLocale } from "../i18n";

// The preview runs in an opaque-origin sandbox: scripts may run, but there is no access to the app,
// its storage, or the network.
const CSP = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:";
// CSP does not cover WebRTC (STUN/TURN lookups can carry data out), so previews lose it before any of their code runs.
const NO_RTC = "<script>for(const k of ['RTCPeerConnection','webkitRTCPeerConnection','RTCDataChannel','RTCSessionDescription','RTCIceCandidate'])try{Object.defineProperty(window,k,{value:undefined,configurable:false})}catch(e){}</script>";

export function previewDocument(artifact: { language: "html" | "svg"; code: string }): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">${NO_RTC}`;
  if (artifact.language === "svg") {
    return `<!doctype html><html><head>${meta}<style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#fff}svg{max-width:100%;max-height:100%}</style></head><body>${artifact.code}</body></html>`;
  }
  // The policy goes first, ahead of any markup or script in the code: the parser puts a leading <meta> into
  // the head even when the code brings its own <html>/<head>, so nothing runs before the policy applies.
  // The code's own doctype is moved ahead of it: a doctype after the <meta> is ignored and the page would
  // render in quirks mode.
  return /<(html|head)[\s>]/i.test(artifact.code)
    ? `<!doctype html>${meta}${artifact.code.replace(/^\uFEFF?\s*(<!doctype[^>]*>)?/i, "")}`
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
  const t = useT();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setSvg(null); setError("");
    renderMermaid(artifact.code).then(s => { if (alive) setSvg(s); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [artifact.code]);
  if (error) return <div className={"artifact-error " + PLACEHOLDER}><b>{t.artifacts.panel.diagramFailed}</b><pre className="m-0 max-w-full font-mono text-[11.5px] leading-[1.6] whitespace-pre-wrap text-danger">{error}</pre></div>;
  if (!svg) return <div className={"artifact-loading " + PLACEHOLDER}>{t.artifacts.panel.drawingDiagram}</div>;
  return <iframe className={FRAME} title={artifact.title} sandbox="" srcDoc={previewDocument({ language: "svg", code: svg })} />;
}

// React artifacts also need eval (JSX is compiled inside the frame); the frame still has no network or app access.
const REACT_CSP = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval'; font-src data:";
const inlineScript = (code: string) => code.replace(/<\/script/gi, "<\\/script");

/** A self-contained page that compiles and renders the component with the bundled runtime (React, lucide-react, recharts, Tailwind). */
export async function reactDocument(code: string): Promise<string> {
  const [{ default: runtime }, { default: tailwind }] = await Promise.all([
    import("../generated/artifact-runtime.js?raw"),
    import("@tailwindcss/browser?raw")
  ]);
  const source = JSON.stringify(code).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${REACT_CSP}">${NO_RTC}`
    + `<style>html,body{margin:0;background:#fff;color:#111;font-family:system-ui,-apple-system,"Hiragino Sans","Yu Gothic UI",sans-serif}</style>`
    + `<script>${inlineScript(tailwind)}</script><script>${inlineScript(runtime)}</script></head>`
    + `<body><div id="root"></div><script>window.__runArtifact(${source},${JSON.stringify(getLocale())})</script></body></html>`;
}

function ReactPreview({ artifact }: { artifact: ArtifactRequest }) {
  const t = useT();
  const [doc, setDoc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setDoc(null);
    void reactDocument(artifact.code).then(d => { if (alive) setDoc(d); });
    return () => { alive = false; };
  }, [artifact.code]);
  if (!doc) return <div className={"artifact-loading " + PLACEHOLDER}>{t.artifacts.panel.preparingComponent}</div>;
  return <iframe className={FRAME} title={artifact.title} sandbox="allow-scripts" srcDoc={doc} />;
}

const FRAME = "artifact-frame min-h-0 w-full flex-1 rounded-[10px] border-0 bg-white";
/** `.artifact-loading, .artifact-error` */
const PLACEHOLDER = "grid flex-1 place-items-center content-center gap-[8px] rounded-[10px] border border-dashed border-line-strong p-[20px] text-[13px] text-muted";

type Props = { artifact: ArtifactRequest; versions: ArtifactRequest[]; onSelect: (artifact: ArtifactRequest) => void; onClose: () => void };

export default function ArtifactPanel({ artifact, versions, onSelect, onClose }: Props) {
  const t = useT();
  const a = t.artifacts.panel;
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const index = Math.max(0, versions.findIndex(v => v.code === artifact.code));
  function download() {
    const type = { html: "text/html", svg: "image/svg+xml", markdown: "text/markdown", mermaid: "text/plain", react: "text/javascript" }[artifact.language];
    const url = URL.createObjectURL(new Blob([artifact.code], { type }));
    const link = document.createElement("a");
    const base = artifact.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "artifact";
    link.href = url; link.download = `${base}.${KIND_EXT[artifact.language]}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // An <aside>/<header>: these utilities also carry what the old app-wide `aside{}` / `header{}` rules gave it
  // (border-right, overflow hidden, width/padding transition; header font-size, color, bold weight).
  return <aside className="artifact-panel flex min-h-0 w-[min(470px,42%)] shrink-0 animate-slide-in flex-col gap-[10px] overflow-hidden border-x border-line bg-panel px-[18px] py-[16px] transition-[width,padding] duration-[.22s] ease-claude" aria-label={a.label}>
    <header className="flex h-auto shrink-0 items-center justify-start gap-[8px] border-0 p-0 text-[12px] text-muted">
      <b className="font-serif text-[14px] font-medium text-ink">{artifact.title}</b><small className="flex-[0_0_auto] text-[11px] text-muted">{KIND_LABEL[artifact.language]}</small>
      {versions.length > 1 && <span className="alt-switch artifact-versions mx-[2px] inline-flex items-center gap-0 text-[11.5px] text-muted tabular-nums" aria-label={a.versions}>
        <button className="icon-action" disabled={index === 0} onClick={() => onSelect(versions[index - 1])} aria-label={a.previousVersion}><ChevronLeft size={15} /></button>
        v{index + 1} / {versions.length}
        <button className="icon-action" disabled={index >= versions.length - 1} onClick={() => onSelect(versions[index + 1])} aria-label={a.nextVersion}><ChevronRight size={15} /></button>
      </span>}
      <span className="spacer flex-1" />
      <div className="segmented small" role="tablist">
        <button role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>{a.preview}</button>
        <button role="tab" aria-selected={tab === "code"} className={tab === "code" ? "active" : ""} onClick={() => setTab("code")}>{a.code}</button>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label={t.common.close}><X size={16} /></button>
    </header>
    {tab === "code"
      ? <pre className="artifact-code m-0 min-h-0 flex-1 overflow-auto rounded-[10px] border border-line bg-code p-[12px] font-mono text-[11.5px] leading-[1.6] whitespace-pre-wrap text-ink-3 light:text-[#DAD6CC]">{artifact.code}</pre>
      : artifact.language === "markdown"
        ? <div className="artifact-doc min-h-0 flex-1 overflow-auto rounded-[10px] border border-line bg-surface px-[22px] py-[18px]"><Markdown text={artifact.code} className="font-chat text-[14.5px] leading-[1.8] text-ink-3" /></div>
        : artifact.language === "mermaid"
          ? <MermaidPreview artifact={artifact} />
          : artifact.language === "react"
          ? <ReactPreview artifact={artifact} />
          : <iframe className={FRAME} title={artifact.title} sandbox="allow-scripts" srcDoc={previewDocument({ language: artifact.language, code: artifact.code })} />}
    {artifact.language !== "markdown" && <p className="hint mb-0">{a.sandboxHint}{artifact.language === "react" && a.reactLibraries}</p>}
    <div className="artifact-actions flex items-center gap-[8px]">
      <button className="btn-secondary" onClick={download}><Download size={14} /> {a.saveAs(KIND_EXT[artifact.language])}</button>
      <CopyButton text={artifact.code} />
    </div>
  </aside>;
}
