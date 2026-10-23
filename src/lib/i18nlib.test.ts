import { describe, expect, it } from "vitest";
import { setLocale } from "../i18n";
import { priceHint } from "./pricing";
import { PLAN_LABELS } from "./credit";
import { continuePrompt } from "./continue";

describe("lib strings by language", () => {
  it("keeps Japanese by default", () => {
    expect(priceHint("claude-opus-5-5")).toBe("入力 $4 / 出力 $20 per MTok");
    expect(PLAN_LABELS.custom).toBe("カスタム");
    expect(continuePrompt()).toMatch(/^（直前の回答/);
  });
  it("switches to English", () => {
    setLocale("en");
    try {
      expect(priceHint("claude-opus-5-5")).toBe("In $4 / Out $20 per MTok");
      expect(PLAN_LABELS.none).toBe("Not applicable");
      expect(PLAN_LABELS.max5x).toBe("Max 5x");
      expect(continuePrompt()).toMatch(/^\(Your previous reply/);
    } finally { setLocale("ja"); }
  });
});
