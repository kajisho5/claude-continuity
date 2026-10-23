import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";

async function copyText(text: string) {
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

function CodeBlock({ children }: { children?: ReactNode }) {
  const child = Array.isArray(children) ? children[0] : children;
  const className = (child as { props?: { className?: string } })?.props?.className ?? "";
  const language = /language-([\w-]+)/.exec(className)?.[1] ?? "text";
  return <div className="code-block">
    <div className="code-head"><span>{language}</span><CopyButton text={plainText(children).replace(/\n$/, "")} /></div>
    <pre>{children}</pre>
  </div>;
}

/** Renders assistant Markdown (GFM tables, code highlighting). Raw HTML is never rendered. */
function MarkdownBody({ text }: { text: string }) {
  return <div className="markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: true }]]}
      components={{
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>
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
