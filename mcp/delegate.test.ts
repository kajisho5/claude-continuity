import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { delegate, readFiles, resolveAllowed, truncateResult, worstCaseUsd } from "./delegate";
import { appendLedger, readLedgerRows } from "./data";

let base = "";
let root = "";
beforeEach(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-"));
  root = path.join(base, "allowed");
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, "notes.md"), "# メモ\n売上 +12%");
  await fs.writeFile(path.join(base, "secret.txt"), "secret");
});
afterEach(async () => { await fs.rm(base, { recursive: true, force: true }); });

describe("resolveAllowed", () => {
  it("accepts files inside a root and rejects everything else", async () => {
    expect(await resolveAllowed(path.join(root, "notes.md"), [root])).toBe(await fs.realpath(path.join(root, "notes.md")));
    await expect(resolveAllowed(path.join(root, "..", "secret.txt"), [root])).rejects.toThrow("許可フォルダの外");
    await expect(resolveAllowed(path.join(root, "missing.md"), [root])).rejects.toThrow("見つかりません");
    await expect(resolveAllowed(path.join(root, "notes.md"), [])).rejects.toThrow("CONTINUITY_MCP_ROOTS");
  });
  it("rejects symlinks that point outside the root", async () => {
    await fs.symlink(path.join(base, "secret.txt"), path.join(root, "link.txt"));
    await expect(resolveAllowed(path.join(root, "link.txt"), [root])).rejects.toThrow("許可フォルダの外");
  });
});

describe("readFiles", () => {
  it("reads text, skips binaries and reports outside paths", async () => {
    await fs.writeFile(path.join(root, "blob.bin"), Buffer.from([1, 0, 2, 3]));
    const result = await readFiles([path.join(root, "notes.md"), path.join(root, "blob.bin"), path.join(base, "secret.txt")], [root]);
    expect(result.read.map(r => path.basename(r.path))).toEqual(["notes.md"]);
    expect(result.blocks).toHaveLength(1);
    expect(result.skipped.join("\n")).toContain("バイナリ");
    expect(result.skipped.join("\n")).toContain("許可フォルダの外");
  });
});

describe("cost guard and truncation", () => {
  it("estimates the worst case with the full output budget", () => {
    expect(worstCaseUsd("claude-opus-5-5", 100_000)).toBeCloseTo((100_000 * 5 + 16_000 * 20) / 1e6, 10);
    expect(worstCaseUsd("claude-unknown", 1)).toBeNull();
  });
  it("truncates long results", () => {
    expect(truncateResult("abcdef", 3)).toEqual({ text: "abc", truncated: true });
    expect(truncateResult("ab", 3)).toEqual({ text: "ab", truncated: false });
  });
  it("refuses to call the API when the estimate exceeds the per-call cap", async () => {
    let streamed = false;
    const client = {
      messages: {
        countTokens: async () => ({ input_tokens: 400_000 }),
        stream: () => { streamed = true; throw new Error("should not stream"); }
      }
    } as unknown as Parameters<typeof delegate>[0];
    await expect(delegate(client, { instructions: "要約して" }, { roots: [root], defaultModel: "claude-opus-5-5", maxUsdPerCall: 1, resultsDir: base }))
      .rejects.toThrow("上限");
    expect(streamed).toBe(false);
  });
});

describe("ledger", () => {
  it("appends MCP rows and merges them with app usage", async () => {
    await fs.writeFile(path.join(base, "usage.json"), JSON.stringify([{ model: "claude-opus-5-5", inputTokens: 1, outputTokens: 1, createdAt: "2026-10-01T00:00:00Z" }]));
    await appendLedger(base, { source: "mcp", model: "claude-opus-5-5", inputTokens: 10, outputTokens: 5 });
    await appendLedger(base, { source: "mcp", model: "claude-opus-5-5", inputTokens: 20, outputTokens: 5 });
    const rows = await readLedgerRows(base);
    expect(rows.map(r => r.inputTokens)).toEqual([1, 10, 20]);
  });
});
