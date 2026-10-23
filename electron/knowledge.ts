import { mainT } from "./i18n";

/**
 * Retrieval over a project's text knowledge, for when it is too large to send whole with every request
 * (the Claude apps switch to searching project knowledge in the same situation). Claude gets a client tool
 * that returns the best-matching passages; ranking is BM25 over words, with character bigrams for Japanese/CJK.
 */
export type KnowledgeDoc = { id: string; name: string; text: string };
export type Chunk = { doc: string; name: string; index: number; text: string; terms: Map<string, number>; length: number };
export type KnowledgeIndex = { chunks: Chunk[]; df: Map<string, number>; avgLength: number };

const CHUNK_CHARS = 1500;
const OVERLAP = 200;

/** Splits on paragraph boundaries where possible, keeping a little overlap so a passage is not cut off from its context. */
export function chunkText(text: string, size = CHUNK_CHARS, overlap = OVERLAP): string[] {
  const clean = text.replace(/\r\n?/g, "\n");
  if (clean.length <= size) return clean.trim() ? [clean.trim()] : [];
  const out: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size);
    if (end < clean.length) {
      const para = clean.lastIndexOf("\n\n", end);
      const line = clean.lastIndexOf("\n", end);
      const sentence = Math.max(clean.lastIndexOf("。", end), clean.lastIndexOf(". ", end));
      const cut = [para, line, sentence].find(i => i > start + size * 0.5);
      if (cut !== undefined) end = cut + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) out.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return out;
}

const CJK = /[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/;
/** Lowercased words for Latin text; overlapping character bigrams for runs of Japanese/CJK characters. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const run of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (!CJK.test(run)) { if (run.length > 1 || /\d/.test(run)) out.push(run); continue; }
    // Mixed runs (e.g. "q3売上") are split into their Latin and CJK parts first.
    for (const part of run.match(new RegExp(`${CJK.source}+|[^${CJK.source.slice(1, -1)}]+`, "g")) ?? []) {
      if (!CJK.test(part)) { out.push(part); continue; }
      if (part.length === 1) out.push(part);
      for (let i = 0; i + 2 <= part.length; i++) out.push(part.slice(i, i + 2));
    }
  }
  return out;
}

export function buildIndex(docs: KnowledgeDoc[]): KnowledgeIndex {
  const chunks: Chunk[] = [];
  const df = new Map<string, number>();
  for (const doc of docs) {
    chunkText(doc.text).forEach((text, index) => {
      const terms = new Map<string, number>();
      const tokens = tokenize(text);
      for (const term of tokens) terms.set(term, (terms.get(term) ?? 0) + 1);
      for (const term of terms.keys()) df.set(term, (df.get(term) ?? 0) + 1);
      chunks.push({ doc: doc.id, name: doc.name, index, text, terms, length: tokens.length });
    });
  }
  const avgLength = chunks.length ? chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length : 0;
  return { chunks, df, avgLength };
}

export type KnowledgeHit = { name: string; index: number; score: number; text: string };
export function searchKnowledge(index: KnowledgeIndex, query: string, max = 6): KnowledgeHit[] {
  const qTerms = [...new Set(tokenize(query))];
  if (!qTerms.length || !index.chunks.length) return [];
  const n = index.chunks.length, k1 = 1.2, b = 0.75;
  const scored = index.chunks.map(chunk => {
    let score = 0;
    for (const term of qTerms) {
      const tf = chunk.terms.get(term);
      if (!tf) continue;
      const df = index.df.get(term) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * chunk.length / (index.avgLength || 1)));
    }
    return { chunk, score };
  }).filter(s => s.score > 0);
  return scored.sort((a, b2) => b2.score - a.score).slice(0, Math.min(Math.max(max, 1), 12))
    .map(({ chunk, score }) => ({ name: chunk.name, index: chunk.index, score: Math.round(score * 100) / 100, text: chunk.text }));
}

/** Text layer of a PDF (empty for scanned PDFs without one). */
export async function pdfText(data: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  try {
    const { text } = await extractText(pdf, { mergePages: false });
    return (Array.isArray(text) ? text : [text]).map(page => page.trim()).filter(Boolean).join("\n\n");
  } finally { await (pdf as { destroy?: () => Promise<void> }).destroy?.().catch(() => {}); }
}

export function knowledgeTool() {
  const t = mainT().knowledge;
  return {
    name: "search_project_knowledge",
    description: t.toolDescription,
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: t.queryDescription },
        max_results: { type: "integer", description: t.maxResultsDescription }
      },
      required: ["query"]
    }
  };
}

export function formatKnowledgeHits(hits: KnowledgeHit[]): string {
  const t = mainT().knowledge;
  if (!hits.length) return t.noHits;
  return hits.map(h => `${t.hitHeading(h.name, h.index + 1)}\n${h.text}`).join("\n\n---\n\n");
}
