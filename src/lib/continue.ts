import type { Msg } from "../components/MessageItem";

type Reply = Omit<Msg, "role" | "attachments" | "alternates" | "altIndex">;
export const CONTINUE_PROMPT = "（直前の回答は出力の上限などで途中で止まりました。止まった箇所の直後から、前置きや繰り返しなしで続きだけを書いてください。）";
/** Appends a continuation to a cut-off reply, renumbering its citation markers after the existing ones. */
export function mergeContinuation(previous: Msg, cont: Reply): Msg {
  const offset = previous.citations?.length ?? 0;
  const text = offset && cont.citations?.length ? cont.content.replace(/\[(\d{1,3})\](?![(\[])/g, (_m, n) => `[${Number(n) + offset}]`) : cont.content;
  const { alternates, altIndex, stopReason: _s, ...base } = previous;
  const merged: Msg = {
    ...base, role: "assistant", content: previous.content + text, model: cont.model ?? previous.model,
    ...(previous.costUsd != null || cont.costUsd != null ? { costUsd: (previous.costUsd ?? 0) + (cont.costUsd ?? 0) } : {}),
    ...(cont.thinking ? { thinking: [previous.thinking, cont.thinking].filter(Boolean).join("\n\n") } : {}),
    ...(cont.citations?.length ? { citations: [...(previous.citations ?? []), ...cont.citations] } : {}),
    ...(cont.files?.length ? { files: [...(previous.files ?? []), ...cont.files] } : {}),
    ...(cont.steps?.length ? { steps: [...(previous.steps ?? []), ...cont.steps] } : {}),
    ...(cont.stopReason ? { stopReason: cont.stopReason } : {}),
    ...(cont.aborted ? { aborted: true } : {})
  };
  // Keep earlier regenerated versions; the version being continued is replaced by the merged text.
  if (!alternates?.length) return merged;
  const index = altIndex ?? alternates.length - 1;
  const { role: _r, attachments: _att, ...version } = merged;
  return { ...merged, alternates: alternates.map((v, i) => i === index ? version : v), altIndex: index };
}
