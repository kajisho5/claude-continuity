import { t } from "../i18n";

/** Code that opens as an artifact (side panel) rather than a plain code block. */
export type ArtifactKind = "html" | "svg" | "markdown" | "mermaid" | "react";
export type ArtifactRequest = { title: string; language: ArtifactKind; code: string };

const MARKDOWN_MIN_LINES = 12;

export function artifactKind(language: string, code: string): ArtifactKind | null {
  const lang = language.toLowerCase();
  if (lang === "html" || lang === "htm") return "html";
  if (lang === "svg" || ((lang === "xml" || lang === "text") && /^\s*<svg[\s>]/i.test(code))) return "svg";
  if (lang === "mermaid" || lang === "mmd") return "mermaid";
  // React components: explicit JSX/TSX blocks, or JS/TS that default-exports a component.
  if ((lang === "jsx" || lang === "tsx" || lang === "react") && /export\s+default/.test(code)) return "react";
  if (["js", "javascript", "ts", "typescript"].includes(lang) && /export\s+default/.test(code) && /from\s+["']react["']|<[A-Z][\w.]*[\s/>]|return\s*\(\s*</.test(code)) return "react";
  // Short Markdown snippets stay inline; longer ones are documents.
  if ((lang === "markdown" || lang === "md") && code.split("\n").length >= MARKDOWN_MIN_LINES) return "markdown";
  return null;
}

export function artifactTitle(kind: ArtifactKind, code: string): string {
  const s = t().lib.artifacts;
  if (kind === "html") return /<title[^>]*>([^<]{1,80})<\/title>/i.exec(code)?.[1]?.trim() || /<h1[^>]*>([^<]{1,80})<\/h1>/i.exec(code)?.[1]?.trim() || s.webPage;
  if (kind === "svg") return /<title[^>]*>([^<]{1,80})<\/title>/i.exec(code)?.[1]?.trim() || s.image;
  if (kind === "react") return /export\s+default\s+(?:function|class)\s+([A-Z]\w{0,60})/.exec(code)?.[1] || /export\s+default\s+([A-Z]\w{0,60})\s*;?\s*$/m.exec(code)?.[1] || s.reactComponent;
  if (kind === "markdown") return /^#{1,3}\s+(.{1,80})$/m.exec(code)?.[1]?.trim() || s.document;
  const titled = /^\s*(?:%%\s*title:|title:?)\s*(.{1,60})$/im.exec(code)?.[1]?.trim();
  const type = /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|journey|mindmap|timeline|gitGraph|quadrantChart|xychart-beta|sankey-beta|block-beta)\b/m.exec(code)?.[1];
  return titled || (type ? s.diagramOf(type) : s.diagram);
}

// Getters so the labels follow the current language wherever they are read.
export const KIND_LABEL: Record<ArtifactKind, string> = { html: "HTML", svg: "SVG", get markdown() { return t().lib.artifacts.document; }, get mermaid() { return t().lib.artifacts.diagram; }, react: "React" };
export const KIND_EXT: Record<ArtifactKind, string> = { html: "html", svg: "svg", markdown: "md", mermaid: "mmd", react: "jsx" };

/** Same kind and title across a chat are treated as versions of one artifact. */
export const artifactKey = (a: ArtifactRequest) => `${a.language}:${a.title}`;

/** Fenced code blocks in a reply that would render as artifacts, in order. */
export function extractArtifacts(markdown: string): ArtifactRequest[] {
  // A single pass over the lines (a regex with a lazy body and a back-reference took minutes on large inputs
  // full of unclosed fences).
  const found: ArtifactRequest[] = [];
  const lines = markdown.split("\n");
  let open: { marker: string; lang: string; start: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!open) {
      const m = /^(`{3,}|~{3,})[ \t]*([\w-]*)/.exec(line);
      if (m) open = { marker: m[1], lang: m[2], start: i + 1 };
    } else if (line.replace(/[ \t]+$/, "") === open.marker) {
      const code = lines.slice(open.start, i).join("\n");
      const kind = artifactKind(open.lang || "text", code);
      if (kind) found.push({ language: kind, title: artifactTitle(kind, code), code });
      open = null;
    }
  }
  return found;
}
