import { describe, expect, it } from "vitest";
import { artifactKey, artifactKind, artifactTitle, extractArtifacts } from "./artifacts";

describe("artifactKind", () => {
  it("recognizes previewable kinds", () => {
    expect(artifactKind("html", "<p>")).toBe("html");
    expect(artifactKind("xml", "<svg></svg>")).toBe("svg");
    expect(artifactKind("mermaid", "graph TD")).toBe("mermaid");
    expect(artifactKind("md", "# a")).toBeNull();
    expect(artifactKind("markdown", Array(12).fill("line").join("\n"))).toBe("markdown");
    expect(artifactKind("python", "print(1)")).toBeNull();
    expect(artifactKind("jsx", "export default function App(){ return <div/> }")).toBe("react");
    expect(artifactKind("tsx", "const x = 1")).toBeNull();
    expect(artifactKind("javascript", "import { useState } from 'react';\nexport default function Counter(){ return <p/> }")).toBe("react");
    expect(artifactKind("javascript", "export default { a: 1 }")).toBeNull();
  });
});

describe("artifactTitle", () => {
  it("derives readable titles", () => {
    expect(artifactTitle("html", "<html><head><title>売上</title>")).toBe("売上");
    expect(artifactTitle("html", "<h1>見出し</h1>")).toBe("見出し");
    expect(artifactTitle("markdown", "前置き\n## 議事録\n本文")).toBe("議事録");
    expect(artifactTitle("mermaid", "sequenceDiagram\nA->>B: hi")).toBe("図（sequenceDiagram）");
    expect(artifactTitle("mermaid", "---\ntitle: 承認フロー\n---\nflowchart LR")).toBe("承認フロー");
    expect(artifactTitle("react", "export default function SalesChart() {}")).toBe("SalesChart");
    expect(artifactTitle("react", "const Board = () => null;\nexport default Board;")).toBe("Board");
    expect(artifactTitle("react", "export default () => null")).toBe("React コンポーネント");
  });
});

describe("extractArtifacts", () => {
  it("finds fenced artifacts and skips ordinary code", () => {
    const text = "説明\n\n```html\n<title>A</title>\n```\n\n```python\nx=1\n```\n\n```mermaid\nflowchart LR\nA-->B\n```";
    const found = extractArtifacts(text);
    expect(found.map(a => [a.language, a.title])).toEqual([["html", "A"], ["mermaid", "図（flowchart）"]]);
    expect(artifactKey(found[0])).toBe("html:A");
  });
});
