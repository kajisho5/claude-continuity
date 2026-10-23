import { describe, expect, it } from "vitest";
import { relativeTime } from "./time";

describe("relativeTime", () => {
  const now = new Date(2026, 9, 23, 12, 0, 0).getTime();
  it("handles missing and invalid input", () => {
    expect(relativeTime(undefined, now)).toBe("");
    expect(relativeTime("nope", now)).toBe("");
  });
  it("uses minutes, hours and days within a week", () => {
    expect(relativeTime(new Date(now - 20_000).toISOString(), now)).toBe("たった今");
    expect(relativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5分前");
    expect(relativeTime(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3時間前");
    expect(relativeTime(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe("2日前");
  });
  it("falls back to a date, with the year when it differs", () => {
    expect(relativeTime(new Date(2026, 6, 4).toISOString(), now)).toBe("7月4日");
    expect(relativeTime(new Date(2025, 0, 2).toISOString(), now)).toBe("2025年1月2日");
  });
  it("treats future timestamps as now", () => {
    expect(relativeTime(new Date(now + 60_000).toISOString(), now)).toBe("たった今");
  });
});
