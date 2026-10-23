import { t } from "../i18n";

/** One tool call made while answering (mirrors electron/request.ts ToolStep). */
export type ToolStep = {
  kind: "search" | "fetch" | "code" | "file" | "memory" | "history" | "knowledge" | "connector" | "other";
  label: string;
  detail?: string;
  output?: string;
  error?: boolean;
  sources?: { url: string; title: string }[];
};

/** Notice for replies that ended before Claude finished; null when the reply is complete. */
export function stopNotice(stopReason: string | undefined): { text: string; canContinue: boolean } | null {
  const s = t().lib.stop;
  switch (stopReason) {
    case undefined: case "end_turn": case "stop_sequence": return null;
    case "max_tokens": return { text: s.maxTokens, canContinue: true };
    case "refusal": return { text: s.refusal, canContinue: false };
    case "pause_turn": case "tool_use": return { text: s.toolLimit, canContinue: true };
    case "model_context_window_exceeded": return { text: s.contextExceeded, canContinue: false };
    default: return { text: s.other(stopReason), canContinue: true };
  }
}
