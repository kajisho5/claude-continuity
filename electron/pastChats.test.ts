import { describe, expect, it } from "vitest";
import { formatHits, searchPastChats } from "./pastChats";

const chats = [
  { id: "a", title: "四半期レビュー", updatedAt: "2026-10-01T00:00:00Z", messages: [{ role: "user", content: "Q3 の売上は +12%。CAC が悪化した。" }] },
  { id: "b", title: "旅行の計画", updatedAt: "2026-10-05T00:00:00Z", messages: [{ role: "user", content: "京都に行く予定" }] },
  { id: "c", title: "採用", projectId: "p1", messages: [{ role: "user", content: "CAC とは別に採用コスト" }] },
  { id: "d", title: "今の会話", messages: [{ role: "user", content: "CAC について" }] }
];

describe("searchPastChats", () => {
  it("finds chats by keyword and excludes the current chat", () => {
    const hits = searchPastChats(chats, "CAC", { excludeId: "d" });
    expect(hits.map(h => h.id)).toEqual(["a"]);
    expect(hits[0].excerpt).toContain("CAC");
  });
  it("keeps project scope", () => {
    expect(searchPastChats(chats, "CAC", { projectId: "p1" }).map(h => h.id)).toEqual(["c"]);
  });
  it("matches a Japanese phrase through 2-character pieces", () => {
    expect(searchPastChats(chats, "京都旅行の件", {}).map(h => h.id)[0]).toBe("b");
  });
  it("ranks title hits first and formats results", () => {
    const hits = searchPastChats(chats, "四半期", {});
    expect(hits[0].id).toBe("a");
    expect(formatHits(hits)).toContain("「四半期レビュー」（2026-10-01）");
    expect(formatHits([])).toContain("見つかりませんでした");
  });
});
