import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { delegate } from "./delegate";
import { appendLedger, defaultDataDir, readCredit, readLedgerRows } from "./data";
import { PLAN_LABELS, formatShortDate, summarizeCredit } from "../src/lib/credit";
import { formatUsd } from "../src/lib/pricing";

// Configuration comes from the MCP client's env block (see README "MCP 連携").
const env = process.env;
const dataDir = env.CONTINUITY_DATA_DIR || defaultDataDir();
const roots = (env.CONTINUITY_MCP_ROOTS ?? "").split(path.delimiter).map(s => s.trim()).filter(Boolean);
const config = {
  roots,
  defaultModel: env.CONTINUITY_MCP_MODEL || "claude-opus-5-5",
  maxUsdPerCall: Number(env.CONTINUITY_MCP_MAX_USD_PER_CALL) > 0 ? Number(env.CONTINUITY_MCP_MAX_USD_PER_CALL) : 2,
  resultsDir: path.join(dataDir, "mcp-results")
};

async function creditLine(): Promise<string> {
  const summary = summarizeCredit(await readLedgerRows(dataDir), await readCredit(dataDir), new Date());
  if (!summary) return "今月のクレジット: 未設定（Claude Continuity アプリで設定できます）";
  if (summary.plan === "none") return `今月の推定利用額: ${formatUsd(summary.spentUsd)}`;
  return `今月の残額（推定）: ${formatUsd(summary.remainingUsd)} / ${formatUsd(summary.monthlyAmountUsd)} · 失効まで ${summary.daysLeft}日`;
}

const server = new McpServer({ name: "claude-continuity", version: "0.1.0" });

server.registerTool("delegate_task", {
  title: "API に作業を任せる",
  description: "重い読み込みや長い推論を、Max プランの月間 API クレジットで別の Claude に任せ、要約だけを受け取ります。" +
    "大きなファイルは本文を渡さず files にパスを指定してください（サーバーが直接読みます）。" +
    "instructions には目的・前提・出力形式を書いてください。担当者はこの会話を見ていません。",
  inputSchema: {
    instructions: z.string().min(1).max(20_000).describe("目的・前提・欲しい出力形式を含む依頼文"),
    files: z.array(z.string()).max(20).optional().describe("読ませたいローカルファイルの絶対パス（許可フォルダ内のテキスト・PDF）"),
    model: z.string().optional().describe("使うモデル ID（省略時は CONTINUITY_MCP_MODEL）"),
    effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional().describe("思考の深さ"),
    max_result_chars: z.number().int().min(500).max(30_000).optional().describe("返す結果の最大文字数（既定 6000）"),
    save_full_result: z.boolean().optional().describe("全文をファイルに保存し、そのパスも返す")
  },
  annotations: { readOnlyHint: true, openWorldHint: true }
}, async (input) => {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return { content: [{ type: "text", text: "ANTHROPIC_API_KEY が設定されていません。" }], isError: true };
  try {
    const outcome = await delegate(new Anthropic({ apiKey }), input, config);
    await appendLedger(dataDir, { source: "mcp", ...outcome.usage });
    const footer = [
      "---",
      `${outcome.usage.model} · input ${outcome.usage.inputTokens.toLocaleString()} / output ${outcome.usage.outputTokens.toLocaleString()} tokens${outcome.costUsd != null ? ` · 推定 ${formatUsd(outcome.costUsd, 4)}` : ""}`,
      outcome.read.length ? `読み込み: ${outcome.read.map(f => `${f.path} (${Math.ceil(f.bytes / 1024)}KB)`).join(", ")}` : "",
      outcome.skipped.length ? `スキップ: ${outcome.skipped.join(" / ")}` : "",
      outcome.truncated ? `（結果を ${input.max_result_chars ?? 6000} 文字で切り詰めました${outcome.savedTo ? "" : "。全文が必要なら save_full_result を指定してください"}）` : "",
      outcome.savedTo ? `全文: ${outcome.savedTo}` : "",
      await creditLine()
    ].filter(Boolean).join("\n");
    return { content: [{ type: "text", text: `${outcome.text}\n\n${footer}` }] };
  } catch (e) {
    return { content: [{ type: "text", text: `実行できませんでした: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }
});

server.registerTool("credit_status", {
  title: "月間クレジットの残額",
  description: "Claude Continuity が記録した利用量から、今月の API クレジットの推定残額・失効日・1日の目安を返します。",
  inputSchema: {},
  annotations: { readOnlyHint: true }
}, async () => {
  const summary = summarizeCredit(await readLedgerRows(dataDir), await readCredit(dataDir), new Date());
  if (!summary) return { content: [{ type: "text", text: "クレジットが未設定です。Claude Continuity アプリの初期設定でプランと付与日を設定してください。" }] };
  const pace = { under: "余りそう", on: "順調", over: "使いすぎ" }[summary.pace];
  const lines = summary.plan === "none"
    ? [`プラン: ${PLAN_LABELS.none}`, `今月の推定利用額: ${formatUsd(summary.spentUsd)}`]
    : [
      `プラン: ${PLAN_LABELS[summary.plan]}（月 ${formatUsd(summary.monthlyAmountUsd)}）`,
      `推定残額: ${formatUsd(summary.remainingUsd)}（推定使用 ${formatUsd(summary.spentUsd)}）`,
      `サイクル: ${formatShortDate(summary.cycleStart)} 〜 ${formatShortDate(summary.cycleEnd)} · 失効まで ${summary.daysLeft}日`,
      `ペース: ${pace} · 使い切るには 1日あたり ${formatUsd(summary.dailyBudgetUsd)}`,
      summary.calibrated ? "Console の残高で補正済み" : "推定値です。正確な残高は Console の Billing で確認してください"
    ];
  return { content: [{ type: "text", text: lines.join("\n") }] };
});

server.connect(new StdioServerTransport()).catch(error => {
  console.error(error);
  process.exit(1);
});
