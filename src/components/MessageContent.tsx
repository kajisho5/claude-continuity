import { createContext, memo, useContext, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { normalizeMath } from "../lib/math";
import { Atom, Check, ChevronDown, Code2, Copy, Eye, FileText, Image as ImageIcon, Workflow } from "lucide-react";

import { artifactKind, artifactTitle, KIND_LABEL, type ArtifactKind, type ArtifactRequest } from "../lib/artifacts";
import { useT } from "../i18n";
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

const COPY_BTN = "copy-btn inline-flex items-center gap-[5px] rounded-[6px] border border-line bg-transparent px-[8px] py-[3px] text-[10px] text-muted hover:border-line-input hover:text-ink-2";

/** `className` adds contextual utilities (e.g. the code-block header's light-theme colors). */
export function CopyButton({ text, label: labelProp, iconOnly = false, className = "" }: { text: string; label?: string; iconOnly?: boolean; className?: string }) {
  const t = useT();
  const label = labelProp ?? t.common.copy;
  const [done, setDone] = useState(false);
  return <button className={(iconOnly ? "icon-action" : COPY_BTN) + " tip" + (className ? " " + className : "")} data-tip={done ? t.common.copied : label} aria-label={label}
    onClick={() => { void copyText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
    {done ? <Check size={iconOnly ? 15 : 13} /> : <Copy size={iconOnly ? 15 : 13} />}{!iconOnly && (done ? t.common.copied : label)}
  </button>;
}

/** Shared with the artifacts page (`.artifact-thumb`); callers add the size. */
export const ARTIFACT_THUMB = "artifact-thumb grid shrink-0 place-items-center rounded-[10px] border border-line bg-inset text-link";
const SHIMMER = "shimmer animate-shimmer bg-[image:linear-gradient(90deg,var(--muted)_0%,var(--muted)_40%,var(--text)_50%,var(--muted)_60%,var(--muted)_100%)] bg-size-[250%_100%] bg-clip-text text-transparent";

/** Previewable code shows as an artifact card that opens the side panel, as in the Claude apps. */
function ArtifactCard({ language, code, children }: { language: ArtifactKind; code: string; children: ReactNode }) {
  const t = useT();
  const openArtifact = useContext(ArtifactContext)!;
  const [showCode, setShowCode] = useState(false);
  const title = artifactTitle(language, code);
  const lines = code.split("\n").length;
  return <div className="artifact-card-wrap my-[.9em] font-sans">
    <div className="artifact-card group/card flex max-w-[440px] cursor-pointer items-center gap-[14px] rounded-[14px] border border-line-strong bg-surface py-[10px] pr-[14px] pl-[10px] transition-[border-color,transform,box-shadow] duration-150 ease-[ease] hover:border-line-input hover:shadow-[0_6px_20px_#0004] hover:[transform:translateY(-1px)]" role="button" tabIndex={0} onClick={() => openArtifact({ title, language, code })}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openArtifact({ title, language, code }); } }}>
      <span className={ARTIFACT_THUMB + " size-[52px]"}>{language === "svg" ? <ImageIcon size={20} /> : language === "markdown" ? <FileText size={20} /> : language === "mermaid" ? <Workflow size={20} /> : language === "react" ? <Atom size={20} /> : <Code2 size={20} />}</span>
      <span className="artifact-meta flex min-w-0 flex-1 flex-col gap-[3px]"><b className="truncate text-[14px] font-semibold text-ink">{title}</b><small className="text-[11.5px] text-muted">{t.message.artifactMeta(KIND_LABEL[language], lines)}</small></span>
      <Eye size={16} className="artifact-open shrink-0 text-subtle group-hover/card:text-ink-3" />
    </div>
    <button className="artifact-code-toggle mt-[6px] mr-0 mb-0 ml-[4px] inline-flex items-center gap-[5px] rounded-[6px] border-0 bg-transparent px-[4px] py-[3px] text-[11.5px] text-subtle hover:text-ink-3" onClick={() => setShowCode(v => !v)} aria-expanded={showCode}>
      <ChevronDown size={13} className={"transition-transform duration-[.18s] ease-claude" + (showCode ? " open rotate-180" : "")} />{showCode ? t.message.hideCode : t.message.showCode}</button>
    {showCode && <CodeFrame language={language} code={code}>{children}</CodeFrame>}
  </div>;
}

function CodeFrame({ language, code, children }: { language: string; code: string; children: ReactNode }) {
  return <div className="code-block my-[.8em] overflow-hidden rounded-[12px] border border-line bg-code">
    <div className="code-head flex items-center justify-between bg-surface py-[5px] pr-[8px] pl-[12px] font-mono text-[10px] text-muted light:bg-[#2A2926] light:text-[#B9B4A8]"><span>{language}</span><span className="code-actions flex gap-[6px]"><CopyButton text={code} className="light:border-[#45433E]! light:text-[#B9B4A8]!" /></span></div>
    <pre className="m-0 overflow-x-auto px-[14px] py-[12px] text-[12px] leading-[1.6]">{children}</pre>
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
function MarkdownBody({ text, className }: { text: string; className?: string }) {
  return <div className={"markdown" + (className ? " " + className : "")}>
    <ReactMarkdown remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }], [rehypeHighlight, { detect: true }]]}
      components={{
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        a: ({ href, children, title }) => <a href={href} title={title} target="_blank" rel="noreferrer">{children}</a>
      }}>{normalizeMath(text)}</ReactMarkdown>
  </div>;
}
export const Markdown = memo(MarkdownBody);

export function ThinkingBlock({ text, live, seconds }: { text: string; live?: boolean; seconds?: number }) {
  const t = useT();
  if (!text && !live) return null;
  const label = live ? t.message.thinkingLive : seconds != null && seconds >= 1 ? t.message.thoughtFor(Math.round(seconds)) : t.message.thinkingProcess;
  return <details className={"thinking group/think mt-0 mx-0 mb-[10px] rounded-[9px] border-0 bg-transparent text-[13px]" + (live ? " live" : "")}>
    <summary className="inline-flex cursor-pointer list-none items-center gap-[6px] rounded-[6px] py-[4px] pr-[8px] pl-0 text-muted select-none hover:text-ink-2 [&::-webkit-details-marker]:hidden"><span className={live ? SHIMMER : ""}>{label}</span><ChevronDown size={14} className="chev transition-transform duration-200 ease-claude group-open/think:rotate-180" /></summary>
    {text && <div className="thinking-body mt-[6px] mx-0 mb-[4px] max-h-[360px] animate-fade-in overflow-auto border-l-2 border-line-strong py-[2px] pr-0 pl-[14px] text-[13px] leading-[1.7] whitespace-pre-wrap text-muted">{text}</div>}
  </details>;
}
