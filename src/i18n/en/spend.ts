import type { spend as Ja } from "../ja/spend";

export const spend: typeof Ja = {
  estimate: {
    line: (tokens: string, usd: string) => `Estimate when sent: input about ${tokens} tokens · ${usd}`,
    batchNote: " (half price with Batch)",
    withoutTools: " · tool definitions not included",
    counting: "Estimating the cost…",
    limits: (today: string, daily: string | null, perMessage: string | null) => [`Today ${today}${daily ? ` / limit ${daily}` : ""}`, perMessage ? `per-message limit ${perMessage}` : ""].filter(Boolean).join(" · "),
    detail: "The input is what will be sent (history, attachments, instructions), counted with Anthropic's free count_tokens. Prompt caching usually makes the real cost lower."
  },
  confirm: {
    title: "This message may go over your limit",
    intro: "Check before sending.",
    input: "Estimated input",
    inputValue: (tokens: string, usd: string) => `${tokens} tokens · ${usd}`,
    output: (tokens: string) => `Estimated output (about ${tokens})`,
    worst: "Worst case (output up to the maximum)",
    perMessage: "Per-message limit",
    over: (usd: string) => `over ${usd}`,
    within: (usd: string) => `${usd} (within)`,
    today: "Spent today",
    hint: "Tip: send it with Batch (half price), or remove older files, to lower the cost.",
    cancel: "Cancel",
    batch: "Send with Batch",
    send: "Send anyway",
    blocked: (reason: string) => `Not sent: it would go over the ${reason}. You can change this in Settings → Credit.`,
    reasonPerMessage: "per-message limit",
    reasonDaily: "daily limit"
  },
  limits: {
    heading: "Spending limits",
    intro: "Before sending, the cost is estimated (with the free count_tokens) and the message is held if it would go over a limit. The estimate leaves out tool definitions.",
    perMessage: "Per-message limit",
    daily: "Daily limit",
    emptyMeansNone: "Leave empty for no limit",
    mode: "When a message would go over",
    confirm: "Ask me",
    block: "Don't send",
    invalid: "Enter an amount above 0 (up to $10,000).",
    save: "Save",
    saved: "Saved"
  },
  longChats: {
    heading: "Long chats",
    intro: "Earlier messages that no longer fit the model's input are summarized and sent instead of being dropped (with the API's compaction, or a summary of our own on models without it).",
    toggle: "Summarize earlier messages and keep going",
    note: "The summary is rewritten about every 20 turns. Its cost is recorded with your usage. Incognito chats don't keep it."
  },
  divider: {
    text: (n: number) => `The ${n} messages above are sent as a summary`,
    view: "View summary",
    title: "Summary being sent",
    encrypted: "The API returned this summary encrypted, so its text can't be shown (it is still sent as is).",
    close: "Close"
  },
  batch: {
    tool: "Batch (half price, arrives later)",
    toolDesc: "Sent at half price; the reply arrives later (usually within an hour, at most 24 hours)",
    chip: "Batch (half price)",
    creating: "Creating the batch…",
    created: "Sent with Batch. You'll be notified when the reply arrives.",
    failed: "Couldn't create the batch: ",
    pendingTitle: "Processing with Batch (half price)",
    estimate: (usd: string) => `est. ${usd}`,
    pendingNote: "Usually arrives within an hour (at most 24 hours). You'll be notified.",
    sentAt: (time: string) => `Sent at ${time}`,
    canceling: "Canceling…",
    cancel: "Cancel",
    expired: "Not processed within 24 hours (not billed)",
    canceled: "Canceled",
    errored: "Couldn't be processed",
    resend: "Send normally",
    nav: "Batch",
    pageTitle: "Batch",
    pageIntro: "Half price, delivered later. Results can be retrieved for 29 days.",
    empty: "Nothing sent with Batch yet. Turn on \"Batch\" in the tools menu to send that chat's messages at half price.",
    status: { pending: (min: number) => `Processing ${min} min`, done: "Done", expired: "Expired", canceled: "Canceled", errored: "Error" },
    meta: (model: string, cost: string, time: string) => [model, cost, time].filter(Boolean).join(" · "),
    costHalf: (usd: string) => `${usd} (half price)`,
    open: "Open",
    clear: "Clear finished",
    notifyTitle: "A batch reply arrived",
    unavailableIncognito: "Batch isn't available in incognito chats"
  },
  suggest: {
    heading: "Before it expires",
    batchSummary: "Summarize past chats with Batch (half price)",
    research: "Start a research task",
    delegate: "Hand work over from Claude Code",
    dismiss: "Not now",
    batchPrompt: "From the attached past chats, write a document that groups them by topic, with the key points, what was decided and what is still open.",
    pastChatsFile: "past-chats.md",
    user: "User",
    assistant: "Assistant"
  }
};
