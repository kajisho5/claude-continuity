import { describe, expect, it } from "vitest";
import { normalizeMath } from "./math";

describe("normalizeMath", () => {
  it("converts LaTeX delimiters", () => {
    expect(normalizeMath("面積は \\(\\pi r^2\\) です")).toBe("面積は $$\\pi r^2$$ です");
    expect(normalizeMath("式:\n\\[ E = mc^2 \\]\n以上")).toBe("式:\n\n$$\nE = mc^2\n$$\n\n以上");
  });
  it("leaves code and plain text alone", () => {
    const code = "```tex\n\\(x\\)\n```";
    expect(normalizeMath(code + " と \\(y\\)")).toBe(code + " と $$y$$");
    expect(normalizeMath("`\\(z\\)`")).toBe("`\\(z\\)`");
    expect(normalizeMath("$100 と $200")).toBe("$100 と $200");
  });
});
