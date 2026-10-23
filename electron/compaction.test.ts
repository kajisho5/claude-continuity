import { describe, expect, it } from "vitest";
import { chunks, fingerprint, supportsCompaction, transcriptMessages, validSummary, type StoredSummary } from "./compaction";
import { buildMessages, selectHistoryRange, summaryText, type ChatTurn } from "./request";

const turns: ChatTurn[] = [
  { role: "user", content: "a".repeat(70_000) },
  { role: "assistant", content: "reply 1" },
  { role: "user", content: "b".repeat(70_000) },
  { role: "assistant", content: "reply 2" },
  { role: "user", content: "now" }
];
const caps = { webSearch: true, codeExecution: true, imageInput: true, pdfInput: true };
const loader = { read: async () => Buffer.from(""), uploadForContainer: async () => "file" };

describe("supportsCompaction", () => {
  it("follows the models listed for on-demand compaction", () => {
    expect(supportsCompaction("claude-opus-5-5")).toBe(true);
    expect(supportsCompaction("claude-haiku-5-5")).toBe(true);
    expect(supportsCompaction("claude-haiku-4-5-20251001")).toBe(false);
    expect(supportsCompaction("claude-sonnet-4-5")).toBe(false);
  });
});

describe("selectHistoryRange", () => {
  it("gives where the kept turns start (a user turn)", () => {
    const range = selectHistoryRange(turns, 120_000);
    expect(range.start).toBe(2);
    expect(range.history.map(t => t.content)).toEqual([turns[2].content, "reply 2", "now"]);
    expect(selectHistoryRange(turns.slice(2), 120_000).start).toBe(0);
  });
});

describe("validSummary", () => {
  const stored: StoredSummary = { upto: 2, fingerprint: fingerprint(turns, 2), kind: "api", block: { type: "compaction", content: "s" }, text: "s", model: "claude-opus-5-5", createdAt: "" };
  it("accepts a summary of the same turns on the same model", () => {
    expect(validSummary(stored, turns, "claude-opus-5-5")).toEqual(stored);
  });
  it("drops it when an earlier turn changed, the model changed or it is malformed", () => {
    const edited = turns.map((t, i) => i === 0 ? { ...t, content: "edited" } : t);
    expect(validSummary(stored, edited, "claude-opus-5-5")).toBeNull();
    expect(validSummary(stored, turns, "claude-sonnet-5-5")).toBeNull();
    expect(validSummary({ ...stored, upto: 99 }, turns, "claude-opus-5-5")).toBeNull();
    expect(validSummary({ ...stored, block: { type: "text" } }, turns, "claude-opus-5-5")).toBeNull();
    expect(validSummary(null, turns, "claude-opus-5-5")).toBeNull();
  });
  it("lets a text summary move to another model", () => {
    expect(validSummary({ ...stored, kind: "text", block: undefined }, turns, "claude-sonnet-5-5")).not.toBeNull();
  });
});

describe("transcriptMessages and chunks", () => {
  it("names attachments, merges same-role turns and starts with the user", () => {
    const out = transcriptMessages([
      { role: "assistant", content: "hello" },
      { role: "user", content: "q", attachments: [{ id: "1", name: "a.pdf", mediaType: "application/pdf", size: 1, kind: "pdf" }] },
      { role: "user", content: "more" }
    ], n => `[${n}]`, "(start)");
    expect(out).toEqual([{ role: "user", content: "(start)" }, { role: "assistant", content: "hello" }, { role: "user", content: "[a.pdf]\nq\n\nmore" }]);
  });
  it("splits a long history into parts that fit", () => {
    expect(chunks(turns, 0, 4, 100_000)).toEqual([[0, 2], [2, 4]]);
    expect(chunks(turns, 0, 2, 10)).toEqual([[0, 1], [1, 2]]);
    expect(chunks(turns, 2, 2, 10)).toEqual([]);
  });
});

describe("buildMessages with a summary", () => {
  it("puts a compaction block first, then the kept turns word for word", async () => {
    const block = { type: "compaction", content: "s" };
    const built = await buildMessages(turns, [], loader, { containerUploads: false, caps, summary: { upto: 2, kind: "api", block } });
    expect(built.messages[0]).toEqual({ role: "assistant", content: [block] });
    expect(built.messages.slice(1).map(m => m.role)).toEqual(["user", "assistant", "user"]);
    expect(built.summarized).toBe(2);
    expect(built.omitted).toBe(0);
  });
  it("leads the first kept user turn with a text summary", async () => {
    const built = await buildMessages(turns, [], loader, { containerUploads: false, caps, summary: { upto: 2, kind: "text", text: "earlier" } });
    expect(built.messages[0].role).toBe("user");
    expect((built.messages[0].content as { text: string }[])[0].text).toBe(summaryText("earlier"));
  });
  it("without a summary, drops what does not fit as before", async () => {
    const built = await buildMessages(turns, [], loader, { containerUploads: false, caps, maxChars: 120_000 });
    expect(built.omitted).toBe(2);
    expect(built.summarized).toBe(0);
  });
});
