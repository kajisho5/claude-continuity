import { describe, expect, it } from "vitest";
import { isPastRetention, pendingCount, RESULTS_KEPT_MS, sanitizeJobs } from "./batches";

describe("sanitizeJobs", () => {
  it("keeps valid jobs and drops unknown shapes", () => {
    const jobs = sanitizeJobs([
      { id: "msgbatch_1", chatId: "c1", chatTitle: "t", model: "claude-opus-5-5", createdAt: "2026-10-23T00:00:00Z", status: "pending", estimateUsd: 0.4, result: { text: "x" } },
      { id: "msgbatch_2", chatId: "c2", status: "weird" },
      null, "x"
    ]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: "msgbatch_1", status: "pending", estimateUsd: 0.4, result: { text: "x" } });
    expect(sanitizeJobs("nope")).toEqual([]);
  });
  it("keeps only the newest 200", () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ id: `b${i}`, chatId: "c", status: "done", createdAt: "" }));
    const jobs = sanitizeJobs(many);
    expect(jobs).toHaveLength(200);
    expect(jobs[0].id).toBe("b50");
  });
});

describe("retention", () => {
  it("treats a pending job older than 29 days as expired", () => {
    const now = Date.parse("2026-10-23T00:00:00Z");
    const job = { id: "b", chatId: "c", chatTitle: "", model: "", status: "pending" as const, createdAt: new Date(now - RESULTS_KEPT_MS - 1000).toISOString() };
    expect(isPastRetention(job, now)).toBe(true);
    expect(isPastRetention({ ...job, createdAt: new Date(now - 1000).toISOString() }, now)).toBe(false);
    expect(isPastRetention({ ...job, status: "done" }, now)).toBe(false);
    expect(pendingCount([job, { ...job, status: "done" }])).toBe(1);
  });
});
