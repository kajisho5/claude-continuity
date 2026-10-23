/** One tool call made while answering (mirrors electron/request.ts ToolStep). */
export type ToolStep = {
  kind: "search" | "fetch" | "code" | "file" | "memory" | "history" | "connector" | "other";
  label: string;
  detail?: string;
  output?: string;
  error?: boolean;
  sources?: { url: string; title: string }[];
};

/** Notice for replies that ended before Claude finished; null when the reply is complete. */
export function stopNotice(stopReason: string | undefined): { text: string; canContinue: boolean } | null {
  switch (stopReason) {
    case undefined: case "end_turn": case "stop_sequence": return null;
    case "max_tokens": return { text: "出力の上限に達したため、回答が途中で終わっています。", canContinue: true };
    case "refusal": return { text: "Claude はこの依頼への回答を控えました。言い方や内容を変えて、もう一度お試しください。", canContinue: false };
    case "pause_turn": case "tool_use": return { text: "ツールの実行回数の上限に達したため、途中で止めました。", canContinue: true };
    case "model_context_window_exceeded": return { text: "会話が長くなり、モデルが扱える量を超えたため途中で終わっています。新しい会話で続けてください。", canContinue: false };
    default: return { text: `回答が途中で終わりました（${stopReason}）。`, canContinue: true };
  }
}
