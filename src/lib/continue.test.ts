import { describe, expect, it } from "vitest";
import { mergeContinuation } from "./continue";

describe("mergeContinuation", () => {
  it("appends text, sums cost, keeps the newest stop reason only when still cut off", () => {
    const merged = mergeContinuation(
      { role: "assistant", content: "前半", costUsd: 0.01, stopReason: "max_tokens", model: "m1", alternates: [{ content: "x" }], altIndex: 0 },
      { content: "後半", costUsd: 0.02, model: "m2" });
    expect(merged.content).toBe("前半後半");
    expect(merged.costUsd).toBeCloseTo(0.03);
    expect(merged.stopReason).toBeUndefined();
    expect(merged.model).toBe("m2");
    expect(merged.alternates).toEqual([expect.objectContaining({ content: "前半後半" })]);
    expect(merged.altIndex).toBe(0);
  });
  it("renumbers citation markers after the existing ones", () => {
    const merged = mergeContinuation(
      { role: "assistant", content: "A[1]", citations: [{ url: "u1", title: "t1" }] },
      { content: "B[1] C[2]", citations: [{ url: "u2", title: "t2" }, { url: "u3", title: "t3" }], stopReason: "max_tokens" });
    expect(merged.content).toBe("A[1]B[2] C[3]");
    expect(merged.citations?.map(c => c.url)).toEqual(["u1", "u2", "u3"]);
    expect(merged.stopReason).toBe("max_tokens");
  });
});
