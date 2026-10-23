// Official list prices in USD per million tokens (https://platform.claude.com/docs/en/about-claude/pricing, checked 2026-10-23).
// Cache writes use the 5-minute rate, which is the API default.
export type Price = { input: number; cacheWrite: number; cacheHit: number; output: number };
export type UsageTokens = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  webSearchRequests?: number;
};

export const PRICING_AS_OF = "2026-10";

const fable51: Price = { input: 10, cacheWrite: 12.5, cacheHit: 0.25, output: 50 };
const fable5: Price = { input: 10, cacheWrite: 12.5, cacheHit: 1, output: 50 };
const opus55: Price = { input: 4, cacheWrite: 5, cacheHit: 0.2, output: 20 };
const opus5: Price = { input: 5, cacheWrite: 6.25, cacheHit: 0.5, output: 25 };
const opusLegacy: Price = { input: 15, cacheWrite: 18.75, cacheHit: 1.5, output: 75 };
const sonnet55: Price = { input: 2, cacheWrite: 2.5, cacheHit: 0.1, output: 10 };
const sonnet5: Price = { input: 2, cacheWrite: 2.5, cacheHit: 0.2, output: 10 };
const sonnet4: Price = { input: 3, cacheWrite: 3.75, cacheHit: 0.3, output: 15 };
const haiku55: Price = { input: 0.1, cacheWrite: 0.125, cacheHit: 0.01, output: 0.5 };
const haiku55Long: Price = { input: 0.5, cacheWrite: 0.625, cacheHit: 0.05, output: 2.5 };
const haiku45: Price = { input: 1, cacheWrite: 1.25, cacheHit: 0.1, output: 5 };
const haiku35: Price = { input: 0.8, cacheWrite: 1, cacheHit: 0.08, output: 4 };

const TABLE: Record<string, Price> = {
  "claude-fable-5-1": fable51,
  "claude-mythos-5-1": fable51,
  "claude-fable-5": fable5,
  "claude-mythos-5": fable5,
  "claude-opus-5-5": opus55,
  "claude-opus-5": opus5,
  "claude-opus-4-8": opus5,
  "claude-opus-4-7": opus5,
  "claude-opus-4-6": opus5,
  "claude-opus-4-5": opus5,
  "claude-opus-4-1": opusLegacy,
  "claude-opus-4": opusLegacy,
  "claude-sonnet-5-5": sonnet55,
  "claude-sonnet-5": sonnet5,
  "claude-sonnet-4-6": sonnet4,
  "claude-sonnet-4-5": sonnet4,
  "claude-sonnet-4": sonnet4,
  "claude-haiku-5-5": haiku55,
  "claude-haiku-4-5": haiku45,
  "claude-3-5-haiku": haiku35
};

// Web search is billed per search on top of tokens: $10 per 1,000 searches.
export const WEB_SEARCH_USD = 0.01;
// Claude Haiku 5.5 charges higher rates when the whole prompt (including cache reads/writes) exceeds 100k tokens.
const HAIKU_55_LONG_PROMPT = 100_000;

/** Strips date snapshots (e.g. -20250929) and -latest so dated IDs share their family price. */
export function modelFamily(modelId: string): string {
  return modelId.trim().toLowerCase().replace(/-latest$/, "").replace(/-\d{8}$/, "");
}

export function priceFor(modelId: string, promptTokens = 0): Price | null {
  const family = modelFamily(modelId);
  if (family === "claude-haiku-5-5" && promptTokens > HAIKU_55_LONG_PROMPT) return haiku55Long;
  return TABLE[family] ?? null;
}

/** Estimated USD cost of one request, or null when the model has no known price. */
export function costOf(modelId: string, usage: UsageTokens): number | null {
  const cacheWrite = usage.cacheCreationInputTokens ?? 0;
  const cacheRead = usage.cacheReadInputTokens ?? 0;
  const price = priceFor(modelId, usage.inputTokens + cacheWrite + cacheRead);
  if (!price) return null;
  return (usage.inputTokens * price.input + cacheWrite * price.cacheWrite + cacheRead * price.cacheHit +
    usage.outputTokens * price.output) / 1_000_000 + (usage.webSearchRequests ?? 0) * WEB_SEARCH_USD;
}

export function formatUsd(value: number, digits = 2): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(digits)}`;
}

/** Short per-MTok hint such as "入力 $4 / 出力 $20 per MTok". */
export function priceHint(modelId: string): string | null {
  const price = priceFor(modelId);
  if (!price) return null;
  const fmt = (n: number) => `$${Number.isInteger(n) ? n : n.toString()}`;
  return `入力 ${fmt(price.input)} / 出力 ${fmt(price.output)} per MTok`;
}
