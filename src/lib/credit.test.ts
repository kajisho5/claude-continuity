import { describe, expect, it } from "vitest";
import { cycleRange, summarizeCredit, type CreditSettings, type UsageRow } from "./credit";
import { costOf, modelFamily, priceFor } from "./pricing";

const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const ymd = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

describe("cycleRange", () => {
  it("starts this month once the reset day has passed", () => {
    const { start, end } = cycleRange(5, local(2026, 10, 23));
    expect(ymd(start)).toEqual([2026, 10, 5]);
    expect(ymd(end)).toEqual([2026, 11, 5]);
  });
  it("starts last month before the reset day", () => {
    const { start, end } = cycleRange(25, local(2026, 10, 23));
    expect(ymd(start)).toEqual([2026, 9, 25]);
    expect(ymd(end)).toEqual([2026, 10, 25]);
  });
  it("clamps day 31 to the last day of short months", () => {
    expect(ymd(cycleRange(31, local(2026, 2, 28, 1)).start)).toEqual([2026, 2, 28]);
    expect(ymd(cycleRange(31, local(2026, 3, 10)).start)).toEqual([2026, 2, 28]);
    expect(ymd(cycleRange(31, local(2026, 3, 10)).end)).toEqual([2026, 3, 31]);
  });
  it("crosses the year boundary", () => {
    const { start, end } = cycleRange(15, local(2027, 1, 3));
    expect(ymd(start)).toEqual([2026, 12, 15]);
    expect(ymd(end)).toEqual([2027, 1, 15]);
  });
  it("treats the reset day itself as the new cycle", () => {
    expect(ymd(cycleRange(5, local(2026, 10, 5, 0)).start)).toEqual([2026, 10, 5]);
  });
});

describe("pricing", () => {
  it("maps dated snapshots to their family", () => {
    expect(modelFamily("claude-sonnet-4-5-20250929")).toBe("claude-sonnet-4-5");
    expect(priceFor("claude-sonnet-4-5-20250929")?.output).toBe(15);
    expect(priceFor("claude-opus-4-20250514")?.input).toBe(15);
    expect(priceFor("claude-opus-4-5-20251101")?.input).toBe(5);
  });
  it("returns null for unknown models", () => {
    expect(priceFor("claude-unknown-9")).toBeNull();
    expect(costOf("claude-unknown-9", { inputTokens: 10, outputTokens: 10 })).toBeNull();
  });
  it("prices Opus 5.5 input, output and cache tokens", () => {
    const cost = costOf("claude-opus-5-5", { inputTokens: 12_340, outputTokens: 1_024, cacheCreationInputTokens: 1_000, cacheReadInputTokens: 10_000 });
    expect(cost).toBeCloseTo((12_340 * 4 + 1_024 * 20 + 1_000 * 5 + 10_000 * 0.2) / 1e6, 10);
  });
  it("adds $0.01 per web search", () => {
    expect(costOf("claude-opus-5-5", { inputTokens: 0, outputTokens: 0, webSearchRequests: 3 })).toBeCloseTo(0.03, 10);
  });
  it("switches Haiku 5.5 to long-prompt rates above 100k prompt tokens", () => {
    expect(costOf("claude-haiku-5-5", { inputTokens: 100_000, outputTokens: 0 })).toBeCloseTo(0.01, 10);
    expect(costOf("claude-haiku-5-5", { inputTokens: 90_000, outputTokens: 0, cacheReadInputTokens: 20_000 }))
      .toBeCloseTo((90_000 * 0.5 + 20_000 * 0.05) / 1e6, 10);
  });
});

describe("summarizeCredit", () => {
  const settings: CreditSettings = { plan: "max20x", monthlyAmountUsd: 200, resetDay: 5, onboardingDone: true };
  // $4 input + $20 output per MTok on Opus 5.5: 1M input + 1M output = $24.
  const row = (createdAt: Date, model = "claude-opus-5-5"): UsageRow =>
    ({ model, inputTokens: 1_000_000, outputTokens: 1_000_000, createdAt: createdAt.toISOString() });

  it("returns null when setup was skipped", () => {
    expect(summarizeCredit([], null, local(2026, 10, 23))).toBeNull();
    expect(summarizeCredit([], { ...settings, plan: null }, local(2026, 10, 23))).toBeNull();
  });
  it("counts only usage inside the current cycle", () => {
    const rows = [row(local(2026, 10, 4)), row(local(2026, 10, 6)), row(local(2026, 10, 20))];
    const summary = summarizeCredit(rows, settings, local(2026, 10, 23))!;
    expect(summary.spentUsd).toBeCloseTo(48, 6);
    expect(summary.remainingUsd).toBeCloseTo(152, 6);
    expect(summary.daysLeft).toBe(13);
  });
  it("flags under-use against the elapsed share of the cycle", () => {
    const summary = summarizeCredit([row(local(2026, 10, 6))], settings, local(2026, 10, 25))!;
    expect(summary.pace).toBe("under");
    expect(summary.dailyBudgetUsd).toBeCloseTo((200 - 24) / summary.daysLeft, 6);
  });
  it("flags over-use", () => {
    const rows = Array.from({ length: 6 }, () => row(local(2026, 10, 6)));
    expect(summarizeCredit(rows, settings, local(2026, 10, 8))!.pace).toBe("over");
  });
  it("uses a calibration from this cycle and ignores an expired one", () => {
    const rows = [row(local(2026, 10, 6)), row(local(2026, 10, 21))];
    const calibrated = summarizeCredit(rows,
      { ...settings, calibration: { balanceUsd: 120, observedAt: local(2026, 10, 20).toISOString() } }, local(2026, 10, 23))!;
    expect(calibrated.calibrated).toBe(true);
    expect(calibrated.remainingUsd).toBeCloseTo(96, 6);
    const expired = summarizeCredit(rows,
      { ...settings, calibration: { balanceUsd: 10, observedAt: local(2026, 9, 20).toISOString() } }, local(2026, 10, 23))!;
    expect(expired.calibrated).toBe(false);
    expect(expired.remainingUsd).toBeCloseTo(152, 6);
  });
  it("counts unpriced models separately", () => {
    const summary = summarizeCredit([row(local(2026, 10, 6), "claude-unknown-9")], settings, local(2026, 10, 23))!;
    expect(summary.unpricedCalls).toBe(1);
    expect(summary.spentUsd).toBe(0);
  });
  it("reports spending without a budget for credit-less plans", () => {
    const summary = summarizeCredit([row(local(2026, 10, 6))], { ...settings, plan: "none", monthlyAmountUsd: 0 }, local(2026, 10, 23))!;
    expect(summary.monthlyAmountUsd).toBe(0);
    expect(summary.spentUsd).toBeCloseTo(24, 6);
  });
});

describe("daysLeft across a daylight-saving change", () => {
  it("counts calendar days, not 24-hour blocks", () => {
    const settings: CreditSettings = { plan: "max20x", monthlyAmountUsd: 200, resetDay: 5, onboardingDone: true };
    // 4 days 23.5 wall-clock hours before the next reset, whichever DST rules the test machine uses.
    const now = new Date(2026, 9, 31, 0, 30);
    const summary = summarizeCredit([], settings, now);
    expect(summary?.daysLeft).toBe(5);
  });
});

describe("parseAmount", () => {
  it("accepts full-width digits, $ and separators", async () => {
    const { parseAmount } = await import("./credit");
    expect(parseAmount("１００")).toBe(100);
    expect(parseAmount("$12.50")).toBe(12.5);
    expect(parseAmount("1,000")).toBe(1000);
    expect(parseAmount("")).toBeNaN();
  });
});
