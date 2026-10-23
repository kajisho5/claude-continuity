import { costOf } from "./pricing";
import type { CreditSummary, UsageRow } from "./credit";

/** Output assumed for the estimate (replies vary; the worst case uses the model's maximum). */
export const TYPICAL_OUTPUT_TOKENS = 2000;

export type CostEstimate = { inputUsd: number; typicalUsd: number; worstUsd: number; outputUsd: number };

/** Cost of sending `inputTokens` to `model`: the input alone, with a typical reply, and with the longest possible reply. */
export function estimateCost(model: string, inputTokens: number, maxOutputTokens: number, batch = false): CostEstimate | null {
  const input = costOf(model, { inputTokens, outputTokens: 0, batch });
  const typicalOut = costOf(model, { inputTokens: 0, outputTokens: TYPICAL_OUTPUT_TOKENS, batch });
  const maxOut = costOf(model, { inputTokens: 0, outputTokens: maxOutputTokens, batch });
  if (input == null || typicalOut == null || maxOut == null) return null;
  return { inputUsd: input, outputUsd: typicalOut, typicalUsd: input + typicalOut, worstUsd: input + maxOut };
}

/** Spent since local midnight (every recorded request, MCP and Batch included). */
export function spentToday(rows: UsageRow[], now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return rows.reduce((sum, row) => {
    const at = Date.parse(row.createdAt);
    return at >= midnight && at <= now.getTime() ? sum + (costOf(row.model, row) ?? 0) : sum;
  }, 0);
}

export type Limits = { limitPerMessageUsd: number | null; limitDailyUsd: number | null };
export type LimitCheck = { perMessage: boolean; daily: boolean };
/** Whether a message estimated at `estimateUsd` would pass the per-message or the daily limit. */
export function checkLimits(limits: Limits, estimateUsd: number, todayUsd: number): LimitCheck {
  return {
    perMessage: limits.limitPerMessageUsd != null && estimateUsd > limits.limitPerMessageUsd,
    daily: limits.limitDailyUsd != null && todayUsd + estimateUsd > limits.limitDailyUsd
  };
}
export const hasLimits = (limits: Limits) => limits.limitPerMessageUsd != null || limits.limitDailyUsd != null;

/** Days before expiry when the card starts suggesting ways to use the credit. */
export const SUGGEST_DAYS = 7;
export const cycleKey = (summary: CreditSummary) => summary.cycleStart.toISOString();
/** Credit likely to go unused soon: a granted plan, at most a week left, behind pace, money left, not dismissed this cycle. */
export function shouldSuggest(summary: CreditSummary | null, dismissedCycle: string): boolean {
  return !!summary && summary.plan !== "none" && summary.daysLeft <= SUGGEST_DAYS && summary.pace === "under"
    && summary.remainingUsd > 0 && dismissedCycle !== cycleKey(summary);
}

type ChatLike = { title: string; updatedAt?: string; incognito?: boolean; messages: { role: string; content: string }[] };
/** Recent chats as one Markdown document (newest first, up to `maxChars`), for the "summarize past chats" suggestion. */
export function pastChatsDocument(chats: ChatLike[], maxChars = 150_000, labels = { user: "User", assistant: "Assistant" }): string {
  const sorted = chats.filter(c => !c.incognito && c.messages.some(m => m.content.trim()))
    .sort((a, b) => (Date.parse(b.updatedAt ?? "") || 0) - (Date.parse(a.updatedAt ?? "") || 0));
  let out = "";
  for (const c of sorted) {
    const body = c.messages.filter(m => m.content.trim()).map(m => `**${m.role === "user" ? labels.user : labels.assistant}:** ${m.content.trim()}`).join("\n\n");
    const section = `# ${c.title}${c.updatedAt ? ` (${c.updatedAt.slice(0, 10)})` : ""}\n\n${body}\n\n`;
    if (out.length + section.length > maxChars) { if (!out) out = section.slice(0, maxChars); break; }
    out += section;
  }
  return out;
}
