import { createHash } from "node:crypto";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import type { ChatTurn, HistorySummary } from "./request";

/**
 * Long chats: the turns that no longer fit the history budget are summarized once and the summary is sent in
 * their place, with the newest turns kept word for word.
 *
 * Models that support on-demand compaction get the API's own summary (beta "compact-2026-09-04"; the returned
 * block is sent first as an assistant message, https://platform.claude.com/docs/en/build-with-claude/compaction-keep-recent-turns).
 * Other models get a plain-text summary written by the cheapest Haiku.
 */
export const COMPACTION_BETA = "compact-2026-09-04";
// "Compaction that keeps recent turns": supportedModels (checked 2026-10-23).
const COMPACTION_MODELS = [
  "claude-fable-5-1", "claude-mythos-5-1", "claude-fable-5", "claude-mythos-5", "claude-mythos-preview",
  "claude-opus-5-5", "claude-opus-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6",
  "claude-sonnet-5-5", "claude-sonnet-5", "claude-sonnet-4-6", "claude-haiku-5-5"
];
export const supportsCompaction = (model: string) => COMPACTION_MODELS.includes(model.trim().toLowerCase().replace(/-\d{8}$/, ""));

/** What a chat keeps between replies (also shown as "summary" in the thread). */
export type StoredSummary = {
  upto: number; fingerprint: string; kind: "api" | "text";
  block?: Record<string, unknown>; text: string; model: string; createdAt: string;
};

const filled = (t: ChatTurn) => !!(t.content || t.attachments?.length);

/** Identifies the summarized turns, so an edit or a deleted message before `upto` makes the summary stale. */
export function fingerprint(turns: ChatTurn[], upto: number): string {
  const hash = createHash("sha256");
  for (const t of turns.slice(0, upto)) hash.update(JSON.stringify([t.role, t.content, (t.attachments ?? []).map(a => a.id)]));
  return hash.digest("hex").slice(0, 32);
}

/** A stored summary that still matches the conversation and the model, or null. */
export function validSummary(stored: unknown, turns: ChatTurn[], model: string): StoredSummary | null {
  const s = stored as StoredSummary | null | undefined;
  if (!s || typeof s !== "object" || !Number.isInteger(s.upto) || s.upto <= 0 || s.upto > turns.length) return null;
  if (s.kind !== "api" && s.kind !== "text") return null;
  if (s.fingerprint !== fingerprint(turns, s.upto)) return null;
  // A compaction block is only reused on the model that wrote it.
  if (s.kind === "api" && (s.model !== model || !s.block || s.block.type !== "compaction")) return null;
  if (s.kind === "text" && typeof s.text !== "string") return null;
  return s;
}

export const asHistorySummary = (s: StoredSummary): HistorySummary =>
  s.kind === "api" ? { upto: s.upto, kind: "api", block: s.block } : { upto: s.upto, kind: "text", text: s.text };

/** Turns as plain text messages for the summarizer: attachments are named, not sent; roles alternate, starting with the user. */
export function transcriptMessages(turns: ChatTurn[], attachmentLabel: (names: string) => string, startLabel: string): MessageParam[] {
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const t of turns.filter(filled)) {
    const names = (t.attachments ?? []).map(a => a.name).join(", ");
    const text = [names ? attachmentLabel(names) : "", t.content].filter(Boolean).join("\n");
    const last = messages[messages.length - 1];
    if (last && last.role === t.role) last.content += "\n\n" + text;
    else messages.push({ role: t.role, content: text });
  }
  if (messages[0]?.role === "assistant") messages.unshift({ role: "user", content: startLabel });
  return messages;
}

/** Splits turns [from, to) into runs of at most `budget` characters (each run holds at least one turn). */
export function chunks(turns: ChatTurn[], from: number, to: number, budget: number): [number, number][] {
  const out: [number, number][] = [];
  let i = from;
  while (i < to) {
    let size = 0, j = i;
    while (j < to && (j === i || size + turns[j].content.length <= budget)) { size += turns[j].content.length; j++; }
    out.push([i, j]);
    i = j;
  }
  return out;
}
