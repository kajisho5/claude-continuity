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

describe("stopNotice in English", async () => {
  const { setLocale } = await import("../i18n");
  it("uses English text", () => {
    setLocale("en");
    try {
      expect(stopNotice("max_tokens")?.text).toBe("The reply was cut off because it reached the output limit.");
      expect(stopNotice("something_new")?.text).toBe("The reply ended early (something_new).");
    } finally { setLocale("ja"); }
  });
});
