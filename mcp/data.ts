import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CreditSettings, UsageRow } from "../src/lib/credit";

export const MCP_LEDGER = "usage-mcp.jsonl";

/** The app stores data under <userData>/claude-continuity; userData is named after productName (packaged) or package name (dev). */
export function defaultDataDir(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  const base = platform === "win32" ? env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming")
    : platform === "darwin" ? path.join(os.homedir(), "Library", "Application Support")
    : env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  const candidates = ["Claude Continuity", "claude-continuity"].map(name => path.join(base, name, "claude-continuity"));
  return candidates.find(dir => existsSync(dir)) ?? candidates[0];
}

export async function appendLedger(dataDir: string, row: Omit<UsageRow, "createdAt"> & { source: "mcp" }) {
  await fs.mkdir(dataDir, { recursive: true });
  // Append-only so the app (which rewrites usage.json) and this server never clobber each other.
  await fs.appendFile(path.join(dataDir, MCP_LEDGER), JSON.stringify({ ...row, createdAt: new Date().toISOString() }) + "\n", "utf8");
}

export async function readLedgerRows(dataDir: string): Promise<UsageRow[]> {
  const rows: UsageRow[] = [];
  try {
    const app = JSON.parse(await fs.readFile(path.join(dataDir, "usage.json"), "utf8"));
    if (Array.isArray(app)) rows.push(...app);
  } catch { /* no app usage yet */ }
  rows.push(...await readMcpRows(dataDir));
  return rows;
}

export async function readMcpRows(dataDir: string): Promise<UsageRow[]> {
  try {
    return (await fs.readFile(path.join(dataDir, MCP_LEDGER), "utf8")).split("\n").filter(Boolean).flatMap(line => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  } catch { return []; }
}

export async function readCredit(dataDir: string): Promise<CreditSettings | null> {
  try { return JSON.parse(await fs.readFile(path.join(dataDir, "credit.json"), "utf8")); } catch { return null; }
}
