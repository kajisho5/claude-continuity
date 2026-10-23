export const lib = {
  time: {
    justNow: "たった今",
    minutesAgo: (n: number) => `${n}分前`,
    hoursAgo: (n: number) => `${n}時間前`,
    daysAgo: (n: number) => `${n}日前`,
    monthDay: (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`,
    yearMonthDay: (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  },
  stop: {
    maxTokens: "出力の上限に達したため、回答が途中で終わっています。",
    refusal: "Claude はこの依頼への回答を控えました。言い方や内容を変えて、もう一度お試しください。",
    toolLimit: "ツールの実行回数の上限に達したため、途中で止めました。",
    contextExceeded: "会話が長くなり、モデルが扱える量を超えたため途中で終わっています。新しい会話で続けてください。",
    other: (reason: string) => `回答が途中で終わりました（${reason}）。`
  },
  artifacts: {
    webPage: "Web ページ",
    image: "画像",
    reactComponent: "React コンポーネント",
    document: "文書",
    diagram: "図",
    diagramOf: (type: string) => `図（${type}）`
  },
  handoff: {
    intro: "これは別のアプリ（Claude API）で続けていた会話の引き継ぎです。以下の文脈を踏まえて、続きを手伝ってください。",
    me: "私",
    speaker: (name: string) => `【${name}】`,
    truncated: "…（以下略）",
    omitted: "（これより前のやり取りは省略）"
  },
  continuePrompt: "（直前の回答は出力の上限などで途中で止まりました。止まった箇所の直後から、前置きや繰り返しなしで続きだけを書いてください。）",
  pricing: {
    hint: (input: string, output: string) => `入力 ${input} / 出力 ${output} per MTok`
  },
  credit: {
    custom: "カスタム",
    none: "対象外"
  },
  exportHtml: {
    htmlLang: "ja",
    exportedFrom: "Claude Continuity から書き出した会話",
    attachments: "添付: ",
    createdFiles: "作成したファイル: ",
    listSeparator: "、",
    sources: "出典: ",
    disclaimer: "Claude の回答には誤りが含まれることがあります。"
  }
};
