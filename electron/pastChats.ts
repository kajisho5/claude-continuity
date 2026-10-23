/** Client-side tool that lets Claude look up the user's earlier chats, mirroring the Claude apps' chat search. */
export const PAST_CHATS_TOOL = {
  name: "search_past_chats",
  description: "ユーザーの過去の会話（このアプリに保存された履歴）をキーワードで検索し、該当する会話のタイトル・日付・抜粋を返します。ユーザーが以前の話題・決定事項・成果物に触れたとき、または過去の文脈が役立つときに使ってください。",
  input_schema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "探したい内容のキーワード（複数ある場合は空白区切り）" },
      max_results: { type: "integer", description: "返す会話の最大件数（1〜10、既定 5）" }
    },
    required: ["query"]
  }
};

type StoredChat = { id: string; title: string; projectId?: string; updatedAt?: string; messages: { role: string; content: string }[] };
export type PastChatHit = { id: string; title: string; updatedAt?: string; score: number; excerpt: string };

function terms(query: string): string[] {
  const words = query.toLowerCase().split(/[\s、。,.!?！？「」『』()（）]+/).filter(w => w.length >= 1);
  if (words.length > 1 || (words[0]?.length ?? 0) <= 3) return words;
  // A single long Japanese phrase rarely matches verbatim; fall back to its 2-character pieces as well.
  const w = words[0] ?? "";
  const grams = new Set<string>([w]);
  for (let i = 0; i + 2 <= w.length; i++) grams.add(w.slice(i, i + 2));
  return [...grams];
}
function count(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0, i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}
function excerpt(text: string, needles: string[], width = 220): string {
  const lower = text.toLowerCase();
  const at = needles.map(n => lower.indexOf(n)).filter(i => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - width / 2);
  return (start > 0 ? "…" : "") + text.slice(start, start + width).replace(/\s+/g, " ").trim() + (start + width < text.length ? "…" : "");
}

/**
 * Ranks earlier chats by keyword hits (title hits weigh more, full-phrase hits more than 2-character pieces).
 * Scope follows the Claude apps: inside a project only that project's chats, otherwise only chats outside projects.
 */
export function searchPastChats(chats: StoredChat[], query: string, opts: { excludeId?: string; projectId?: string; max?: number }): PastChatHit[] {
  const q = query.trim();
  if (!q) return [];
  const needles = terms(q);
  const full = q.toLowerCase();
  const hits: PastChatHit[] = [];
  for (const chat of chats) {
    if (chat.id === opts.excludeId || (chat.projectId ?? undefined) !== (opts.projectId ?? undefined)) continue;
    const title = (chat.title ?? "").toLowerCase();
    const body = chat.messages.map(m => m.content).join("\n");
    const lower = body.toLowerCase();
    let score = count(title, full) * 12 + count(lower, full) * 4;
    for (const n of needles) if (n !== full) score += count(title, n) * 3 + Math.min(count(lower, n), 20) * (n.length >= 3 ? 2 : 1);
    if (score > 0) hits.push({ id: chat.id, title: chat.title, ...(chat.updatedAt ? { updatedAt: chat.updatedAt } : {}), score, excerpt: excerpt(body, [full, ...needles]) });
  }
  return hits.sort((a, b) => b.score - a.score || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, Math.min(Math.max(opts.max ?? 5, 1), 10));
}

export function formatHits(hits: PastChatHit[]): string {
  if (!hits.length) return "該当する過去の会話は見つかりませんでした。";
  return hits.map((h, i) => `${i + 1}. 「${h.title}」${h.updatedAt ? `（${h.updatedAt.slice(0, 10)}）` : ""}\n${h.excerpt}`).join("\n\n");
}
