import { describe, expect, it } from "vitest";
import { buildMessages, buildSystem, buildTools, extractFileIds, extractText, selectHistory, type ModelCaps } from "./request";
import type { Attachment } from "./attachments";

const caps: ModelCaps = { webSearch: true, codeExecution: true, imageInput: true, pdfInput: true };
const att = (kind: Attachment["kind"], name: string): Attachment => ({ id: name, name, kind, size: 3, mediaType: kind === "image" ? "image/png" : kind === "pdf" ? "application/pdf" : "text/plain" });
const loader = { read: async () => Buffer.from("abc"), uploadForContainer: async (a: Attachment) => `file_${a.name}` };

describe("buildSystem", () => {
  it("orders style then project instructions", () => {
    const system = buildSystem("concise", "", { id: "p", name: "Q3", instructions: "円で表示", knowledge: [], memory: false });
    expect(system?.startsWith("回答は簡潔に")).toBe(true);
    expect(system).toContain("# プロジェクト「Q3」の指示\n円で表示");
  });
  it("uses the custom style text and omits empty parts", () => {
    expect(buildSystem("custom", "  関西弁で  ", null)).toBe("関西弁で");
    expect(buildSystem("standard", "", null)).toBeUndefined();
  });
});

describe("selectHistory", () => {
  it("drops leading assistant turns and keeps the newest suffix", () => {
    const turns = [{ role: "assistant" as const, content: "hi" }, { role: "user" as const, content: "a".repeat(10) }, { role: "assistant" as const, content: "b".repeat(10) }, { role: "user" as const, content: "c" }];
    expect(selectHistory(turns, 25).map(t => t.content[0])).toEqual(["a", "b", "c"]);
    expect(selectHistory(turns, 15).map(t => t.content[0])).toEqual(["c"]);
  });
});

describe("buildMessages", () => {
  it("puts knowledge on the first user turn and attachments on their own turn", async () => {
    const { messages, skipped } = await buildMessages([
      { role: "user", content: "first", attachments: [att("image", "a.png")] },
      { role: "assistant", content: "ok" },
      { role: "user", content: "second", attachments: [att("pdf", "b.pdf")] }
    ], [att("text", "kb.md")], loader, { containerUploads: false, caps });
    expect(skipped).toEqual([]);
    expect((messages[0].content as { type: string }[]).map(b => b.type)).toEqual(["document", "image", "text"]);
    expect((messages[2].content as { type: string }[]).map(b => b.type)).toEqual(["document", "text"]);
  });
  it("uploads tabular files to the container only when code tools are on", async () => {
    const turns = [{ role: "user" as const, content: "集計して", attachments: [att("file", "data.xlsx"), att("text", "data.csv")] }];
    const off = await buildMessages(turns, [], loader, { containerUploads: false, caps });
    expect((off.messages[0].content as { type: string }[]).map(b => b.type)).toEqual(["document", "text"]);
    expect(off.skipped[0]).toContain("data.xlsx");
    const on = await buildMessages(turns, [], loader, { containerUploads: true, caps });
    expect(on.messages[0].content).toEqual([
      { type: "container_upload", file_id: "file_data.xlsx" },
      { type: "document", title: "data.csv", source: { type: "text", media_type: "text/plain", data: "abc" } },
      { type: "container_upload", file_id: "file_data.csv" },
      { type: "text", text: "集計して" }
    ]);
  });
  it("skips inputs the model cannot read", async () => {
    const { skipped } = await buildMessages([{ role: "user", content: "x", attachments: [att("image", "a.png")] }], [], loader,
      { containerUploads: false, caps: { ...caps, imageInput: false } });
    expect(skipped[0]).toContain("画像に未対応");
  });
});

describe("buildTools", () => {
  it("adds server tools, skills and memory per flag and capability", () => {
    const all = buildTools({ webSearch: true, webFetch: true, files: true, memory: true }, caps);
    expect(all.tools.map(t => t.type)).toEqual(["web_search_20250305", "web_fetch_20250910", "code_execution_20250825", "memory_20250818"]);
    expect(all.skills).toEqual(["xlsx", "docx", "pptx", "pdf"]);
    const limited = buildTools({ webSearch: true, analysis: true }, { ...caps, webSearch: false, codeExecution: false });
    expect(limited.tools).toEqual([]);
    expect(limited.unavailable).toEqual(["Web 検索", "データ分析"]);
    expect(buildTools({ analysis: true }, caps).skills).toEqual([]);
  });
});

describe("extract helpers", () => {
  it("numbers citations per unique URL", () => {
    const { text, citations } = extractText([
      { type: "server_tool_use", name: "web_search" },
      { type: "text", text: "売上は増加", citations: [{ type: "web_search_result_location", url: "https://a", title: "A", cited_text: "x" }] },
      { type: "text", text: "。広告も", citations: [{ url: "https://b", title: "B" }, { url: "https://a", title: "A" }] },
      { type: "text", text: "上昇。", citations: null }
    ]);
    expect(text).toBe("売上は増加[1]。広告も[2][1]上昇。");
    expect(citations.map(c => c.url)).toEqual(["https://a", "https://b"]);
  });
  it("finds file ids only inside tool results", () => {
    expect(extractFileIds([
      { type: "container_upload", file_id: "file_input" },
      { type: "bash_code_execution_tool_result", content: { type: "bash_code_execution_result", content: [{ type: "bash_code_execution_output", file_id: "file_out" }] } }
    ])).toEqual(["file_out"]);
  });
});
