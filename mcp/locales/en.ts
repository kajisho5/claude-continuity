import type { ja as Ja } from "./ja";

export const en: typeof Ja = {
  delegate: {
    noRoots: "No folders are allowed to be read (set CONTINUITY_MCP_ROOTS)",
    notFound: (p: string) => `Not found: ${p}`,
    outsideRoots: (p: string) => `Outside the allowed folders: ${p}`,
    notFile: (p: string) => `${p} (not a file)`,
    overLimit: (p: string, mb: number) => `${p} (larger than ${mb} MB)`,
    overTotal: (p: string) => `${p} (the total would exceed 8 MB)`,
    binary: (p: string) => `${p} (binary file)`,
    system: (maxChars: number) => [
      "You have been handed a task by another AI assistant. The requester reads only your output.",
      `Keep your output within ${maxChars} characters and put the conclusion and key points first.`,
      "Name the files you relied on, if any, and distinguish facts from guesses. Answer in the language of the request."
    ].join("\n"),
    emptyInstructions: "instructions is empty",
    overBudget: (worst: string, cap: string, tokens: string) => `Not run: the worst-case estimate of ${worst} exceeds the per-call limit of ${cap} (input ${tokens} tokens). Pass fewer files or raise CONTINUITY_MCP_MAX_USD_PER_CALL.`
  },
  server: {
    creditUnset: "This month's credit: not set (configure it in the Claude Continuity app)",
    creditSpent: (usd: string) => `Estimated usage this month: ${usd}`,
    creditRemaining: (remaining: string, monthly: string, days: number) => `Remaining this month (estimate): ${remaining} / ${monthly} · expires in ${days} ${days === 1 ? "day" : "days"}`,
    delegateTitle: "Delegate work to the API",
    delegateDescription: "Hands heavy reading or long reasoning to another Claude, paid from the Max plan's monthly API credit, and returns only the summary. " +
      "For large files, don't paste their contents; list their paths in files (the server reads them directly). " +
      "In instructions, state the goal, context and desired output format. The delegate cannot see this conversation.",
    params: {
      instructions: "The request, including the goal, context and desired output format",
      files: "Absolute paths of local files to read (text or PDF inside the allowed folders)",
      model: "Model ID to use (defaults to CONTINUITY_MCP_MODEL)",
      effort: "Thinking depth",
      maxResultChars: "Maximum characters of the returned result (default 6000)",
      saveFullResult: "Save the full text to a file and also return its path"
    },
    noApiKey: "ANTHROPIC_API_KEY is not set.",
    estimated: (usd: string) => ` · est. ${usd}`,
    read: (list: string) => `Read: ${list}`,
    skipped: (list: string) => `Skipped: ${list}`,
    truncated: (chars: number, saved: boolean) => `(Result truncated to ${chars} characters${saved ? "" : ". Set save_full_result if you need the full text"})`,
    fullText: (p: string) => `Full text: ${p}`,
    failed: (message: string) => `Could not run: ${message}`,
    creditTitle: "Monthly credit balance",
    creditDescription: "Returns this month's estimated API credit balance, expiry date and daily budget, based on the usage recorded by Claude Continuity.",
    creditNotConfigured: "Credit is not set up. Set your plan and grant day in the Claude Continuity app's initial setup.",
    pace: { under: "likely to have some left", on: "on track", over: "overspending" },
    planLabels: { max5x: "Max 5x", max20x: "Max 20x", team: "Team", custom: "Custom", none: "Not applicable" },
    plan: (label: string) => `Plan: ${label}`,
    planMonthly: (label: string, monthly: string) => `Plan: ${label} (${monthly}/month)`,
    remaining: (remaining: string, spent: string) => `Estimated balance: ${remaining} (estimated usage ${spent})`,
    cycle: (start: string, end: string, days: number) => `Cycle: ${start} – ${end} · expires in ${days} ${days === 1 ? "day" : "days"}`,
    paceLine: (pace: string, daily: string) => `Pace: ${pace} · ${daily} per day to use it all`,
    calibrated: "Calibrated with the Console balance",
    estimateNote: "This is an estimate. Check Billing in the Console for the exact balance"
  }
};
