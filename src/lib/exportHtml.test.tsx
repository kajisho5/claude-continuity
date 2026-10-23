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
});
