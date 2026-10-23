import type { message as Ja } from "../ja/message";

const times = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const message: typeof Ja = {
  attachmentKind: { image: "Image", pdf: "PDF", text: "Text", file: "File" },
  couldNotLoad: "Couldn't load this file.",
  truncatedLong: "\n\n… (truncated because it is long)",
  clickToView: (name: string) => `${name} (click to view)`,
  view: (name: string) => `View ${name}`,
  remove: (name: string) => `Remove ${name}`,
  editMessage: "Edit message",
  editHint: "Sending creates a new version with a new reply. Switch between earlier versions and their replies with \"< 1/2 >\".",
  saveAndSend: "Save",
  prevVersion: "Previous version",
  nextVersion: "Next version",
  stoppedPartway: "The reply was stopped partway",
  continue: "Continue",
  createdByClaude: "Created by Claude",
  sources: "Sources",
  regenerate: "Retry",
  prevAnswer: "Previous reply",
  nextAnswer: "Next reply",
  artifactMeta: (kind: string, lines: number) => `${kind} · ${times(lines, "line", "lines")} · Click to open`,
  hideCode: "Hide code",
  showCode: "Show code",
  thinkingLive: "Thinking…",
  thoughtFor: (seconds: number) => `Thought for ${times(seconds, "second", "seconds")}`,
  thinkingProcess: "Thought process",
  steps: {
    search: (n: number) => times(n, "search", "searches"),
    fetch: (n: number) => `${times(n, "page", "pages")} read`,
    code: (n: number) => times(n, "code run", "code runs"),
    memory: (n: number) => times(n, "memory call", "memory calls"),
    history: (n: number) => times(n, "past-chat search", "past-chat searches"),
    connector: (n: number) => times(n, "connector call", "connector calls"),
    other: (n: number) => times(n, "other call", "other calls"),
    hasErrors: "Has errors",
    error: "Error"
  },
  approval: {
    title: (tool: string, server: string) => `Claude wants to use ${tool} from ${server}`,
    hint: "This tool runs on your computer. Review it before allowing.",
    input: "Input",
    allowOnce: "Allow once",
    allowAlways: "Always allow",
    deny: "Deny"
  }
};
