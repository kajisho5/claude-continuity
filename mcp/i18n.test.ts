import { afterEach, describe, expect, it } from "vitest";
import { detectMcpLocale, setMcpLocale } from "./i18n";
import { resolveAllowed } from "./delegate";

afterEach(() => setMcpLocale("ja"));

describe("MCP server locale", () => {
  it("prefers CONTINUITY_MCP_LANG", () => {
    expect(detectMcpLocale({ CONTINUITY_MCP_LANG: "en" }, "ja-JP")).toBe("en");
    expect(detectMcpLocale({ CONTINUITY_MCP_LANG: "ja" }, "en-US")).toBe("ja");
  });
  it("falls back to the Intl locale, then LANG", () => {
    expect(detectMcpLocale({}, "ja-JP")).toBe("ja");
    expect(detectMcpLocale({}, "en-US")).toBe("en");
    expect(detectMcpLocale({ LANG: "ja_JP.UTF-8" }, "")).toBe("ja");
    expect(detectMcpLocale({ LANG: "C" }, "")).toBe("en");
  });
  it("reports errors in English", async () => {
    setMcpLocale("en");
    await expect(resolveAllowed("/tmp/x", [])).rejects.toThrow("No folders are allowed to be read (set CONTINUITY_MCP_ROOTS)");
  });
});
