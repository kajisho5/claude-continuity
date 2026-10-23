import type { lib as Ja } from "../ja/lib";

const date = (d: Date, withYear: boolean) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }).format(d);

export const lib: typeof Ja = {
  time: {
    justNow: "just now",
    minutesAgo: (n: number) => `${n}m ago`,
    hoursAgo: (n: number) => `${n}h ago`,
    daysAgo: (n: number) => `${n}d ago`,
    monthDay: (d: Date) => date(d, false),
    yearMonthDay: (d: Date) => date(d, true)
  },
  stop: {
    maxTokens: "The reply was cut off because it reached the output limit.",
    refusal: "Claude declined to answer this request. Try rephrasing it or changing what you ask.",
    toolLimit: "Stopped partway because the tool-use limit was reached.",
    contextExceeded: "The reply ended early because the conversation grew beyond what the model can handle. Continue in a new chat.",
    other: (reason: string) => `The reply ended early (${reason}).`
  },
  artifacts: {
    webPage: "Web page",
    image: "Image",
    reactComponent: "React component",
    document: "Document",
    diagram: "Diagram",
    diagramOf: (type: string) => `Diagram (${type})`
  },
  handoff: {
    intro: "This is a handoff of a conversation I was having in another app (the Claude API). Please use the context below and help me continue.",
    me: "Me",
    speaker: (name: string) => `[${name}]`,
    truncated: "… (truncated)",
    omitted: "(Earlier messages omitted)"
  },
  continuePrompt: "(Your previous reply stopped partway, e.g. at the output limit. Continue from exactly where it stopped, with no preamble or repetition—write only the rest.)",
  pricing: {
    hint: (input: string, output: string) => `In ${input} / Out ${output} per MTok`
  },
  credit: {
    custom: "Custom",
    none: "Not applicable"
  },
  exportHtml: {
    htmlLang: "en",
    exportedFrom: "Conversation exported from Claude Continuity",
    attachments: "Attachments: ",
    createdFiles: "Files created: ",
    listSeparator: ", ",
    sources: "Sources: ",
    disclaimer: "Claude's answers can contain mistakes."
  }
};
