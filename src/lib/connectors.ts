export type ConnectorView = {
  id: string; name: string; enabled: boolean; transport: "remote" | "local";
  url: string; hasToken: boolean;
  command?: string; args?: string[]; envKeys?: string[]; allowedTools?: string[];
};
/** A Claude asking to run a local MCP tool; answered with "once", "always" or "deny". */
export type ToolApproval = { requestId: string; approvalId: string; server: string; tool: string; input: string };
export type ApprovalDecision = "once" | "always" | "deny";

/**
 * Splits an argument line the way a user would type it: spaces separate, "double" or 'single' quotes group.
 * Backslashes are kept as is so Windows paths (C:\Users\…) survive.
 */
export function splitArgs(line: string): string[] {
  const out: string[] = [];
  let current = "", quote: string | null = null, started = false;
  for (const ch of line) {
    if (quote) { if (ch === quote) quote = null; else current += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; started = true; continue; }
    if (/\s/.test(ch)) { if (started) { out.push(current); current = ""; started = false; } continue; }
    current += ch; started = true;
  }
  if (started) out.push(current);
  return out;
}
/** Inverse of splitArgs for display and editing. */
export function joinArgs(args: string[]): string {
  return args.map(a => a === "" || /[\s"']/.test(a) ? (a.includes('"') ? `'${a}'` : `"${a}"`) : a).join(" ");
}
