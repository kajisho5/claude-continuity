import fs from "node:fs/promises";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { costOf, formatUsd, priceFor } from "../src/lib/pricing";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_PDF_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
export const MAX_OUTPUT_TOKENS = 16_000;

export type DelegateInput = {
  instructions: string;
  files?: string[];
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  max_result_chars?: number;
  save_full_result?: boolean;
};
export type DelegateConfig = { roots: string[]; defaultModel: string; maxUsdPerCall: number; resultsDir: string };
export type ReadFile = { path: string; bytes: number; kind: "text" | "pdf" };

/** Resolves a requested path and confirms it stays inside one of the allowed roots (after following symlinks). */
export async function resolveAllowed(requested: string, roots: string[]): Promise<string> {
  if (!roots.length) throw new Error("読み込みを許可したフォルダがありません（CONTINUITY_MCP_ROOTS を設定してください）");
  const absolute = path.resolve(requested);
  let real: string;
  try { real = await fs.realpath(absolute); } catch { throw new Error(`見つかりません: ${requested}`); }
  for (const root of roots) {
    let realRoot: string;
    try { realRoot = await fs.realpath(path.resolve(root)); } catch { continue; }
    const relative = path.relative(realRoot, real);
    if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return real;
  }
  throw new Error(`許可フォルダの外です: ${requested}`);
}

export async function readFiles(requested: string[], roots: string[]): Promise<{ blocks: ContentBlockParam[]; read: ReadFile[]; skipped: string[] }> {
  const blocks: ContentBlockParam[] = [];
  const read: ReadFile[] = [];
  const skipped: string[] = [];
  let total = 0;
  for (const item of requested.slice(0, 20)) {
    try {
      const real = await resolveAllowed(item, roots);
      const info = await fs.stat(real);
      if (!info.isFile()) { skipped.push(`${item}（ファイルではありません）`); continue; }
      const isPdf = path.extname(real).toLowerCase() === ".pdf";
      const limit = isPdf ? MAX_PDF_BYTES : MAX_FILE_BYTES;
      if (info.size > limit) { skipped.push(`${item}（${Math.round(limit / 1024 / 1024)}MB を超えています）`); continue; }
      if (total + info.size > MAX_TOTAL_BYTES) { skipped.push(`${item}（合計 8MB を超えるため）`); continue; }
      const bytes = await fs.readFile(real);
      if (isPdf) {
        blocks.push({ type: "document", title: item, source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") } });
      } else {
        if (bytes.subarray(0, 8192).includes(0)) { skipped.push(`${item}（バイナリファイル）`); continue; }
        blocks.push({ type: "document", title: item, source: { type: "text", media_type: "text/plain", data: bytes.toString("utf8") } });
      }
      total += info.size;
      read.push({ path: item, bytes: info.size, kind: isPdf ? "pdf" : "text" });
    } catch (e) {
      skipped.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { blocks, read, skipped };
}

/** Upper-bound cost of one call: counted input at full price plus the whole output budget. */
export function worstCaseUsd(model: string, inputTokens: number, maxOutput = MAX_OUTPUT_TOKENS): number | null {
  const price = priceFor(model, inputTokens);
  return price ? (inputTokens * price.input + maxOutput * price.output) / 1_000_000 : null;
}

export function truncateResult(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

const SYSTEM = (maxChars: number) => [
  "あなたは別の AI アシスタントから作業を任された担当者です。依頼者はあなたの出力だけを読みます。",
  `出力は ${maxChars} 文字以内に収め、結論と要点を先に書いてください。`,
  "根拠にした資料があればファイル名を示し、推測と事実を区別してください。依頼の言語で回答してください。"
].join("\n");

export type DelegateOutcome = {
  text: string;
  usage: { model: string; inputTokens: number; outputTokens: number; cacheCreationInputTokens: number; cacheReadInputTokens: number };
  costUsd: number | null;
  read: ReadFile[];
  skipped: string[];
  savedTo?: string;
  truncated: boolean;
};

export async function delegate(client: Anthropic, input: DelegateInput, config: DelegateConfig): Promise<DelegateOutcome> {
  const instructions = String(input.instructions ?? "").trim();
  if (!instructions) throw new Error("instructions が空です");
  const model = input.model?.trim() || config.defaultModel;
  const maxChars = Math.min(30_000, Math.max(500, Math.round(input.max_result_chars ?? 6000)));
  const files = await readFiles(input.files ?? [], config.roots);
  const content: ContentBlockParam[] = [...files.blocks, { type: "text", text: instructions }];
  const request = { model, system: SYSTEM(maxChars), messages: [{ role: "user" as const, content }], ...(input.effort ? { output_config: { effort: input.effort } } : {}) };

  const counted = await client.messages.countTokens(request);
  const worst = worstCaseUsd(model, counted.input_tokens);
  if (worst != null && worst > config.maxUsdPerCall) {
    throw new Error(`見積もり上限 ${formatUsd(worst)} が 1回あたりの上限 ${formatUsd(config.maxUsdPerCall)} を超えるため実行しませんでした（入力 ${counted.input_tokens.toLocaleString()} トークン）。ファイルを減らすか CONTINUITY_MCP_MAX_USD_PER_CALL を上げてください。`);
  }

  const final = await client.messages.stream({ ...request, max_tokens: MAX_OUTPUT_TOKENS, cache_control: { type: "ephemeral" } }).finalMessage();
  const full = final.content.filter(b => b.type === "text").map(b => b.text).join("");
  const usage = {
    model: final.model || model,
    inputTokens: final.usage.input_tokens,
    outputTokens: final.usage.output_tokens,
    cacheCreationInputTokens: final.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: final.usage.cache_read_input_tokens ?? 0
  };
  let savedTo: string | undefined;
  if (input.save_full_result) {
    await fs.mkdir(config.resultsDir, { recursive: true });
    savedTo = path.join(config.resultsDir, `result-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
    await fs.writeFile(savedTo, full, "utf8");
  }
  const { text, truncated } = truncateResult(full, maxChars);
  return { text, usage, costUsd: costOf(usage.model, usage), read: files.read, skipped: files.skipped, savedTo, truncated };
}
