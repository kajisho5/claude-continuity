import { describe, expect, it } from "vitest";
import { HANDOFF_MAX_CHARS, HANDOFF_MAX_ENCODED_WIN, clipToFit, encodedLength, fitsHandoff, fullTranscript, transcriptHandoff } from "./handoff";

const turns = (n: number, size: number) => Array.from({ length: n }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: `${i}:` + "あ".repeat(size) }));

describe("budget", () => {
  it("counts percent-encoded length for Windows", () => {
    expect(fitsHandoff("あ".repeat(3000), "darwin")).toBe(true);
    expect(fitsHandoff("あ".repeat(3500), "win32")).toBe(false);
    expect(fitsHandoff("a".repeat(HANDOFF_MAX_CHARS + 1), "darwin")).toBe(false);
  });
  it("clips without splitting surrogate pairs and fits afterwards", () => {
    const { text, clipped } = clipToFit("😀".repeat(5000), "win32");
    expect(clipped).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(encodedLength(text)).toBeLessThanOrEqual(HANDOFF_MAX_ENCODED_WIN);
  });
});

describe("transcriptHandoff", () => {
  it("keeps everything when it fits", () => {
    const r = transcriptHandoff("t", turns(4, 10), "win32");
    expect(r.included).toBe(4);
    expect(r.text).not.toContain("省略");
    expect(r.text.indexOf("0:")).toBeLessThan(r.text.indexOf("3:"));
  });
  it("drops the oldest turns first and notes it", () => {
    const r = transcriptHandoff("t", turns(20, 400), "win32");
    expect(r.included).toBeLessThan(20);
    expect(r.text).toContain("（これより前のやり取りは省略）");
    expect(r.text).toContain("19:");
    expect(fitsHandoff(r.text, "win32")).toBe(true);
  });
  it("clips a single oversized turn instead of returning nothing", () => {
    const r = transcriptHandoff("t", [{ role: "user", content: "あ".repeat(20000) }], "darwin");
    expect(r.included).toBe(1);
    expect(fitsHandoff(r.text, "darwin")).toBe(true);
  });
  it("full transcript skips empty turns", () => {
    expect(fullTranscript("t", [{ role: "user", content: " " }, { role: "assistant", content: "x" }])).toBe("# t\n\n【Claude】\nx\n");
  });
});

describe("handoff in English", async () => {
  const { setLocale } = await import("../i18n");
  it("labels turns and omissions in English", () => {
    setLocale("en");
    try {
      expect(fullTranscript("t", [{ role: "user", content: "hi" }, { role: "assistant", content: "x" }])).toBe("# t\n\n[Me]\nhi\n\n[Claude]\nx\n");
      const r = transcriptHandoff("t", turns(20, 400), "win32");
      expect(r.text.startsWith("This is a handoff")).toBe(true);
      expect(r.text).toContain("(Earlier messages omitted)");
    } finally { setLocale("ja"); }
  });
});
