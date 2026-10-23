import { describe, expect, it } from "vitest";
import { buildIndex, chunkText, formatKnowledgeHits, searchKnowledge, tokenize } from "./knowledge";

describe("tokenize", () => {
  it("uses words for Latin text and bigrams for Japanese", () => {
    expect(tokenize("Q3 Revenue grew")).toEqual(["q3", "revenue", "grew"]);
    expect(tokenize("売上高")).toEqual(["売上", "上高"]);
    expect(tokenize("Q3売上")).toEqual(["q3", "売上"]);
  });
});

describe("chunkText", () => {
  it("keeps short text whole and splits long text with overlap near paragraph breaks", () => {
    expect(chunkText("short")).toEqual(["short"]);
    const para = (n: number) => `段落${n}。` + "あ".repeat(500);
    const chunks = chunkText([1, 2, 3, 4, 5].map(para).join("\n\n"), 1200, 100);
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1200);
  });
});

describe("searchKnowledge", () => {
  const index = buildIndex([
    { id: "a", name: "就業規則.txt", text: "第1条 勤務時間は9時から18時。\n\n第2条 経費精算は月末締めで翌月10日払い。" },
    { id: "b", name: "handbook.md", text: "Expense reports are due at the end of each month. Travel needs approval." },
    { id: "c", name: "その他.txt", text: "社内イベントは年2回開催します。" }
  ]);
  it("ranks the matching passage first, in Japanese and English", () => {
    expect(searchKnowledge(index, "経費精算の締め日")[0].name).toBe("就業規則.txt");
    expect(searchKnowledge(index, "expense deadline")[0].name).toBe("handbook.md");
    expect(searchKnowledge(index, "zzz")).toEqual([]);
  });
  it("formats hits with the file name and part", () => {
    expect(formatKnowledgeHits(searchKnowledge(index, "経費精算", 1))).toMatch(/^【就業規則\.txt · 第 1 部分】\n第1条/);
    expect(formatKnowledgeHits([])).toContain("見つかりません");
  });
});
