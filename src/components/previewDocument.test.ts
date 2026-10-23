import { describe, expect, it } from "vitest";
import { parse } from "parse5";
import { previewDocument } from "./ArtifactPanel";

const mode = (html: string) => (parse(html) as unknown as { mode: string }).mode;

describe("previewDocument", () => {
  it("puts the policy before the code and keeps standards mode", () => {
    const doc = previewDocument({ language: "html", code: "﻿ <!DOCTYPE html><html lang=\"en\"><head><script>1</script></head><body></body></html>" });
    expect(doc.startsWith("<!doctype html><meta http-equiv=\"Content-Security-Policy\"")).toBe(true);
    expect(doc.match(/<!doctype/gi)).toHaveLength(1);
    expect(mode(doc)).toBe("no-quirks");
  });
  it("wraps fragments", () => {
    const doc = previewDocument({ language: "html", code: "<p>hi</p>" });
    expect(mode(doc)).toBe("no-quirks");
    expect(doc).toContain("<body><p>hi</p></body>");
  });
});
