import { describe, expect, it } from "vitest";
import { chatToHtml } from "./exportHtml";

describe("chatToHtml", () => {
  it("renders a standalone page with escaped user text and Markdown replies", () => {
    const html = chatToHtml({ title: "テスト <会話>", messages: [
      { role: "user", content: "<script>alert(1)</script> 表にして" },
      { role: "assistant", content: "## 結果\n\n| a | b |\n|---|---|\n| 1 | 2 |", citations: [{ url: "https://x.example", title: "X" }] }
    ] });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>テスト &lt;会話&gt;</title>");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<table>");
    expect(html).toContain("<h2>結果</h2>");
    expect(html).toContain('href="https://x.example"');
  });
  it("writes the page chrome in English", async () => {
    const { setLocale } = await import("../i18n");
    setLocale("en");
    try {
      const html = chatToHtml({ title: "T", messages: [{ role: "user", content: "hi", attachments: [{ id: "1", name: "a.txt", mediaType: "text/plain", size: 1, kind: "text" }, { id: "2", name: "b.txt", mediaType: "text/plain", size: 1, kind: "text" }] }] });
      expect(html).toContain('<html lang="en">');
      expect(html).toContain("Conversation exported from Claude Continuity");
      expect(html).toContain("a.txt, b.txt");
      expect(html).toContain("Claude&#x27;s answers can contain mistakes.");
    } finally { setLocale("ja"); }
  });
});
