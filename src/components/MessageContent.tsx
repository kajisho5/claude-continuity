import { createContext, memo, useContext, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy, Eye } from "lucide-react";

export type ArtifactRequest = { title: string; language: "html" | "svg"; code: string };
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

export function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button className="copy-btn" onClick={() => { void copyText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
    {done ? <Check size={13} /> : <Copy size={13} />}{done ? "コピーしました" : label}
  </button>;
}

function previewLanguage(language: string, code: string): "html" | "svg" | null {
  if (language === "html" || language === "htm") return "html";
  if (language === "svg" || ((language === "xml" || language === "text") && /^\s*<svg[\s>]/i.test(code))) return "svg";
  return null;
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const openArtifact = useContext(ArtifactContext);
  const child = Array.isArray(children) ? children[0] : children;
  const className = (child as { props?: { className?: string } })?.props?.className ?? "";
  const language = /language-([\w-]+)/.exec(className)?.[1] ?? "text";
  const code = plainText(children).replace(/\n$/, "");
  const preview = previewLanguage(language, code);
  return <div className="code-block">
    <div className="code-head"><span>{language}</span><span className="code-actions">
      {preview && openArtifact && <button className="copy-btn" onClick={() => openArtifact({ title: preview === "svg" ? "image.svg" : "page.html", language: preview, code })}><Eye size={13} />プレビュー</button>}
      <CopyButton text={code} /></span></div>
    <pre>{children}</pre>
  </div>;
}

/** Turns the [n] markers appended for web citations into links, leaving fenced code untouched. */
export function linkCitations(text: string, citations: { url: string; title: string }[] | undefined): string {
  if (!citations?.length) return text;
  return text.split(/(```[\s\S]*?```)/g).map((part, i) => i % 2 === 1 ? part : part.replace(/\[(\d{1,3})\](?![(\[])/g, (match, n) => {
    const source = citations[Number(n) - 1];
    return source ? `[\\[${n}\\]](${source.url.replace(/[()\s]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"))} "${source.title.replace(/"/g, "'")}")` : match;
  })).join("");
}

/** Renders assistant Markdown (GFM tables, code highlighting). Raw HTML is never rendered. */
function MarkdownBody({ text }: { text: string }) {
  return <div className="markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: true }]]}
      components={{
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        a: ({ href, children, title }) => <a href={href} title={title} target="_blank" rel="noreferrer">{children}</a>
      }}>{text}</ReactMarkdown>
  </div>;
}
export const Markdown = memo(MarkdownBody);

export function ThinkingBlock({ text, live }: { text: string; live?: boolean }) {
  if (!text) return null;
  return <details className="thinking" open={live}>
    <summary>{live ? "考えています…" : "思考の要約"}</summary>
    <div className="thinking-body">{text}</div>
  </details>;
}
