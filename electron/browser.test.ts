import { describe, expect, it } from "vitest";
import { normalizeUrl, pageDocument } from "./browser";

describe("normalizeUrl", () => {
  it("keeps web addresses and adds a scheme to bare hosts", () => {
    expect(normalizeUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(normalizeUrl("example.com/news")).toBe("https://example.com/news");
    expect(normalizeUrl("127.0.0.1:8787/page")).toBe("http://127.0.0.1:8787/page");
    expect(normalizeUrl("localhost:3000")).toBe("http://localhost:3000/");
  });
  it("turns other text into a web search", () => {
    expect(normalizeUrl("ミラーレス 比較")).toBe("https://duckduckgo.com/?q=" + encodeURIComponent("ミラーレス 比較"));
    expect(normalizeUrl("claude")).toBe("https://duckduckgo.com/?q=claude");
  });
  it("refuses other schemes and empty input", () => {
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
  });
});

describe("pageDocument", () => {
  it("puts the title and address first and limits the size", () => {
    expect(pageDocument({ title: "T", url: "https://x.test/", text: "a\n\n\n\nb" })).toBe("# T\n\nhttps://x.test/\n\na\n\nb\n");
    expect(pageDocument({ title: "", url: "https://x.test/", text: "abcdef" }, 3)).toBe("# https://x.test/\n\nhttps://x.test/\n\nabc\n…\n");
  });
});
