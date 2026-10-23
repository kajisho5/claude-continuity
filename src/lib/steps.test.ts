import { describe, expect, it } from "vitest";
import { stopNotice } from "./steps";

describe("stopNotice", () => {
  it("is silent for complete replies", () => {
    expect(stopNotice(undefined)).toBeNull();
    expect(stopNotice("end_turn")).toBeNull();
  });
  it("offers continue only where it can help", () => {
    expect(stopNotice("max_tokens")?.canContinue).toBe(true);
    expect(stopNotice("pause_turn")?.canContinue).toBe(true);
    expect(stopNotice("refusal")?.canContinue).toBe(false);
    expect(stopNotice("model_context_window_exceeded")?.canContinue).toBe(false);
    expect(stopNotice("something_new")?.text).toContain("something_new");
  });
});
