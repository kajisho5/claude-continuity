import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { delegate } from "./delegate";
import { appendLedger, defaultDataDir, readCredit, readLedgerRows } from "./data";
import { formatShortDate, summarizeCredit } from "../src/lib/credit";
import { formatUsd } from "../src/lib/pricing";
import { detectMcpLocale, mcpIntlLocale, mcpT, setMcpLocale } from "./i18n";

// Configuration comes from the MCP client's env block (see README "MCP 連携").
const env = process.env;
setMcpLocale(detectMcpLocale(env));
const t = mcpT().server;
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
  if (!summary) return t.creditUnset;
  if (summary.plan === "none") return t.creditSpent(formatUsd(summary.spentUsd));
  return t.creditRemaining(formatUsd(summary.remainingUsd), formatUsd(summary.monthlyAmountUsd), summary.daysLeft);
}

const server = new McpServer({ name: "claude-continuity", version: "0.1.0" });

server.registerTool("delegate_task", {
  title: t.delegateTitle,
  description: t.delegateDescription,
  inputSchema: {
    instructions: z.string().min(1).max(20_000).describe(t.params.instructions),
    files: z.array(z.string()).max(20).optional().describe(t.params.files),
    model: z.string().optional().describe(t.params.model),
    effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional().describe(t.params.effort),
    max_result_chars: z.number().int().min(500).max(30_000).optional().describe(t.params.maxResultChars),
    save_full_result: z.boolean().optional().describe(t.params.saveFullResult)
  },
  annotations: { readOnlyHint: true, openWorldHint: true }
}, async (input) => {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return { content: [{ type: "text", text: t.noApiKey }], isError: true };
  try {
    const outcome = await delegate(new Anthropic({ apiKey }), input, config);
    await appendLedger(dataDir, { source: "mcp", ...outcome.usage });
    const footer = [
      "---",
      `${outcome.usage.model} · input ${outcome.usage.inputTokens.toLocaleString(mcpIntlLocale())} / output ${outcome.usage.outputTokens.toLocaleString(mcpIntlLocale())} tokens${outcome.costUsd != null ? t.estimated(formatUsd(outcome.costUsd, 4)) : ""}`,
      outcome.read.length ? t.read(outcome.read.map(f => `${f.path} (${Math.ceil(f.bytes / 1024)}KB)`).join(", ")) : "",
      outcome.skipped.length ? t.skipped(outcome.skipped.join(" / ")) : "",
      outcome.truncated ? t.truncated(input.max_result_chars ?? 6000, !!outcome.savedTo) : "",
      outcome.savedTo ? t.fullText(outcome.savedTo) : "",
      await creditLine()
    ].filter(Boolean).join("\n");
    return { content: [{ type: "text", text: `${outcome.text}\n\n${footer}` }] };
  } catch (e) {
    return { content: [{ type: "text", text: t.failed(e instanceof Error ? e.message : String(e)) }], isError: true };
  }
});

server.registerTool("credit_status", {
  title: t.creditTitle,
  description: t.creditDescription,
  inputSchema: {},
  annotations: { readOnlyHint: true }
}, async () => {
  const summary = summarizeCredit(await readLedgerRows(dataDir), await readCredit(dataDir), new Date());
  if (!summary) return { content: [{ type: "text", text: t.creditNotConfigured }] };
  const pace = t.pace[summary.pace];
  const lines = summary.plan === "none"
    ? [t.plan(t.planLabels.none), t.creditSpent(formatUsd(summary.spentUsd))]
    : [
      t.planMonthly(t.planLabels[summary.plan], formatUsd(summary.monthlyAmountUsd)),
      t.remaining(formatUsd(summary.remainingUsd), formatUsd(summary.spentUsd)),
      t.cycle(formatShortDate(summary.cycleStart), formatShortDate(summary.cycleEnd), summary.daysLeft),
      t.paceLine(pace, formatUsd(summary.dailyBudgetUsd)),
      summary.calibrated ? t.calibrated : t.estimateNote
    ];
  return { content: [{ type: "text", text: lines.join("\n") }] };
});

server.connect(new StdioServerTransport()).catch(error => {
  console.error(error);
  process.exit(1);
});
