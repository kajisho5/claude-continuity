import { createContext, memo, useContext, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { normalizeMath } from "../lib/math";
import { Check, ChevronDown, Code2, Copy, Eye, FileText, Image as ImageIcon, Workflow } from "lucide-react";

import { artifactKind, artifactTitle, KIND_LABEL, type ArtifactKind, type ArtifactRequest } from "../lib/artifacts";
export type { ArtifactRequest };
/** Lets code blocks open the artifact panel without threading a prop through react-markdown. */
export const ArtifactContext = createContext<((artifact: ArtifactRequest) => void) | null>(null);

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const area = document.createElement("textarea");
    area.value = text; document.body.appendChild(area); area.select();
    document.execCommand("copy"); area.remove();
  }
}

function plainText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  if (typeof node === "object" && "props" in node) return plainText((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

export function CopyButton({ text, label = "コピー", iconOnly = false }: { text: string; label?: string; iconOnly?: boolean }) {
  const [done, setDone] = useState(false);
  return <button className={(iconOnly ? "icon-action" : "copy-btn") + " tip"} data-tip={done ? "コピーしました" : label} aria-label={label}
    onClick={() => { void copyText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
    {done ? <Check size={iconOnly ? 15 : 13} /> : <Copy size={iconOnly ? 15 : 13} />}{!iconOnly && (done ? "コピーしました" : label)}
  </button>;
}

/** Previewable code shows as an artifact card that opens the side panel, as in the Claude apps. */
function ArtifactCard({ language, code, children }: { language: ArtifactKind; code: string; children: ReactNode }) {
  const openArtifact = useContext(ArtifactContext)!;
  const [showCode, setShowCode] = useState(false);
  const title = artifactTitle(language, code);
  const lines = code.split("\n").length;
  return <div className="artifact-card-wrap">
    <div className="artifact-card" role="button" tabIndex={0} onClick={() => openArtifact({ title, language, code })}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openArtifact({ title, language, code }); } }}>
      <span className="artifact-thumb">{language === "svg" ? <ImageIcon size={20} /> : language === "markdown" ? <FileText size={20} /> : language === "mermaid" ? <Workflow size={20} /> : <Code2 size={20} />}</span>
      <span className="artifact-meta"><b>{title}</b><small>{KIND_LABEL[language]} · {lines} 行 · クリックして開く</small></span>
      <Eye size={16} className="artifact-open" />
    </div>
    <button className="artifact-code-toggle" onClick={() => setShowCode(v => !v)} aria-expanded={showCode}>
      <ChevronDown size={13} className={showCode ? "open" : ""} />{showCode ? "コードを隠す" : "コードを表示"}</button>
    {showCode && <CodeFrame language={language} code={code}>{children}</CodeFrame>}
  </div>;
}

function CodeFrame({ language, code, children }: { language: string; code: string; children: ReactNode }) {
  return <div className="code-block">
    <div className="code-head"><span>{language}</span><span className="code-actions"><CopyButton text={code} /></span></div>
    <pre>{children}</pre>
  </div>;
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const openArtifact = useContext(ArtifactContext);
  const child = Array.isArray(children) ? children[0] : children;
  const className = (child as { props?: { className?: string } })?.props?.className ?? "";
  const language = /language-([\w-]+)/.exec(className)?.[1] ?? "text";
  const code = plainText(children).replace(/\n$/, "");
  const preview = artifactKind(language, code);
  if (preview && openArtifact) return <ArtifactCard language={preview} code={code}>{children}</ArtifactCard>;
  return <CodeFrame language={language} code={code}>{children}</CodeFrame>;
}

/** Turns the [n] markers appended for web citations into links, leaving fenced code untouched. */
export function linkCitations(text: string, citations: { url: string; title: string }[] | undefined): string {
  if (!citations?.length) return text;
  return text.split(/(```[\s\S]*?```)/g).map((part, i) => i % 2 === 1 ? part : part.replace(/\[(\d{1,3})\](?![(\[])/g, (match, n) => {
    const source = citations[Number(n) - 1];
    return source ? `[${n}](${source.url.replace(/[()\s]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"))} "${source.title.replace(/"/g, "'")}")` : match;
  })).join("");
}

/** Renders assistant Markdown (GFM tables, code highlighting). Raw HTML is never rendered. */
function MarkdownBody({ text }: { text: string }) {
  return <div className="markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }], [rehypeHighlight, { detect: true }]]}
      components={{
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        a: ({ href, children, title }) => <a href={href} title={title} target="_blank" rel="noreferrer">{children}</a>
      }}>{normalizeMath(text)}</ReactMarkdown>
  </div>;
}
export const Markdown = memo(MarkdownBody);

export function ThinkingBlock({ text, live, seconds }: { text: string; live?: boolean; seconds?: number }) {
  if (!text && !live) return null;
  const label = live ? "考えています…" : seconds != null && seconds >= 1 ? `${Math.round(seconds)}秒間考えました` : "思考プロセス";
  return <details className={"thinking" + (live ? " live" : "")}>
    <summary><span className={live ? "shimmer" : ""}>{label}</span><ChevronDown size={14} className="chev" /></summary>
    {text && <div className="thinking-body">{text}</div>}
  </details>;
}
