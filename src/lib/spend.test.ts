import { describe, expect, it } from "vitest";
import { checkLimits, estimateCost, hasLimits, pastChatsDocument, shouldSuggest, spentToday, TYPICAL_OUTPUT_TOKENS } from "./spend";
import { costOf } from "./pricing";
import type { CreditSummary } from "./credit";

describe("estimateCost", () => {
  it("prices the input, a typical reply and the longest reply", () => {
    // Opus 5.5: $4 input / $20 output per MTok.
    const e = estimateCost("claude-opus-5-5", 100_000, 128_000)!;
    expect(e.inputUsd).toBeCloseTo(0.4);
    expect(e.typicalUsd).toBeCloseTo(0.4 + TYPICAL_OUTPUT_TOKENS * 20 / 1e6);
    expect(e.worstUsd).toBeCloseTo(0.4 + 128_000 * 20 / 1e6);
  });
  it("halves everything for Batch", () => {
    const full = estimateCost("claude-sonnet-5-5", 50_000, 64_000)!;
    const half = estimateCost("claude-sonnet-5-5", 50_000, 64_000, true)!;
    expect(half.typicalUsd).toBeCloseTo(full.typicalUsd / 2);
  });
  it("is null for an unpriced model", () => {
    expect(estimateCost("some-other-model", 10, 10)).toBeNull();
  });
});

describe("Batch pricing", () => {
  it("bills tokens at half price but web searches in full", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 0, webSearchRequests: 2 };
    expect(costOf("claude-opus-5-5", { ...usage, batch: true })).toBeCloseTo(2 + 0.02);
    expect(costOf("claude-opus-5-5", usage)).toBeCloseTo(4 + 0.02);
  });
});

describe("spentToday", () => {
  it("counts only rows since local midnight", () => {
    const now = new Date(2026, 9, 23, 15, 0);
    const rows = [
      { model: "claude-opus-5-5", createdAt: new Date(2026, 9, 23, 9, 0).toISOString(), inputTokens: 1_000_000, outputTokens: 0 },
      { model: "claude-opus-5-5", createdAt: new Date(2026, 9, 22, 23, 59).toISOString(), inputTokens: 1_000_000, outputTokens: 0 },
      { model: "claude-opus-5-5", createdAt: new Date(2026, 9, 23, 10, 0).toISOString(), inputTokens: 1_000_000, outputTokens: 0, batch: true }
    ];
    expect(spentToday(rows, now)).toBeCloseTo(4 + 2);
  });
});

describe("checkLimits", () => {
  it("flags the per-message and the daily limit separately", () => {
    expect(checkLimits({ limitPerMessageUsd: 0.5, limitDailyUsd: 10 }, 0.74, 3.1)).toEqual({ perMessage: true, daily: false });
    expect(checkLimits({ limitPerMessageUsd: null, limitDailyUsd: 10 }, 0.74, 9.5)).toEqual({ perMessage: false, daily: true });
    expect(checkLimits({ limitPerMessageUsd: null, limitDailyUsd: null }, 99, 99)).toEqual({ perMessage: false, daily: false });
    expect(hasLimits({ limitPerMessageUsd: null, limitDailyUsd: null })).toBe(false);
    expect(hasLimits({ limitPerMessageUsd: 1, limitDailyUsd: null })).toBe(true);
  });
});

describe("shouldSuggest", () => {
  const base = { plan: "max20x", daysLeft: 5, pace: "under", remainingUsd: 148.2, cycleStart: new Date("2026-10-01T00:00:00Z") } as unknown as CreditSummary;
  it("suggests in the last week when the credit is going unused", () => {
    expect(shouldSuggest(base, "")).toBe(true);
  });
  it("stays quiet otherwise", () => {
    expect(shouldSuggest({ ...base, daysLeft: 8 }, "")).toBe(false);
    expect(shouldSuggest({ ...base, pace: "on" }, "")).toBe(false);
    expect(shouldSuggest({ ...base, remainingUsd: 0 }, "")).toBe(false);
    expect(shouldSuggest({ ...base, plan: "none" } as CreditSummary, "")).toBe(false);
    expect(shouldSuggest(null, "")).toBe(false);
    // Dismissed for this cycle.
    expect(shouldSuggest(base, "2026-10-01T00:00:00.000Z")).toBe(false);
  });
});

describe("pastChatsDocument", () => {
  const chats = [
    { title: "Old", updatedAt: "2026-10-01T00:00:00Z", messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] },
    { title: "New", updatedAt: "2026-10-20T00:00:00Z", messages: [{ role: "user", content: "c" }] },
    { title: "Secret", updatedAt: "2026-10-21T00:00:00Z", incognito: true, messages: [{ role: "user", content: "x" }] },
    { title: "Empty", messages: [] }
  ];
  it("lists recent chats newest first, without incognito or empty ones", () => {
    const doc = pastChatsDocument(chats);
    expect(doc.indexOf("# New")).toBeLessThan(doc.indexOf("# Old"));
    expect(doc).not.toContain("Secret");
    expect(doc).not.toContain("Empty");
    expect(doc).toContain("**User:** c");
  });
  it("stops at the size limit", () => {
    expect(pastChatsDocument(chats, 30)).toContain("# New");
    expect(pastChatsDocument(chats, 30)).not.toContain("# Old");
  });
});
