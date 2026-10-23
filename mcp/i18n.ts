import { ja } from "./locales/ja";
import { en } from "./locales/en";

export type McpMessages = typeof ja;
export type McpLocale = "ja" | "en";
const DICTS: Record<McpLocale, McpMessages> = { ja, en };

/**
 * CONTINUITY_MCP_LANG ("ja" | "en") from the MCP client's env block wins; otherwise the OS language
 * (Intl locale, then LC_ALL / LC_MESSAGES / LANG): Japanese for ja*, English otherwise.
 */
export function detectMcpLocale(env: NodeJS.ProcessEnv = process.env, intlLocale = safeIntlLocale()): McpLocale {
  const explicit = String(env.CONTINUITY_MCP_LANG ?? "").trim().toLowerCase();
  if (explicit.startsWith("ja")) return "ja";
  if (explicit.startsWith("en")) return "en";
  const system = [intlLocale, env.LC_ALL, env.LC_MESSAGES, env.LANG].find(v => v && !/^(c|posix)(\.|$)/i.test(v)) ?? "";
  return /^ja/i.test(system) ? "ja" : "en";
}
function safeIntlLocale(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().locale; } catch { return ""; }
}

// Japanese until server.ts detects the locale (the unit tests expect it).
let current: McpLocale = "ja";
export function setMcpLocale(locale: McpLocale): void { current = locale; }
export const getMcpLocale = (): McpLocale => current;
export const mcpIntlLocale = (locale: McpLocale = current): string => locale === "ja" ? "ja-JP" : "en-US";
export const mcpT = (): McpMessages => DICTS[current];
