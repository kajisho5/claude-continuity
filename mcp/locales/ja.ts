/** Strings of the MCP server (tool descriptions, results, errors). Japanese is the source of truth; `en.ts` is typed against it. */
export const ja = {
  delegate: {
    noRoots: "読み込みを許可したフォルダがありません（CONTINUITY_MCP_ROOTS を設定してください）",
    notFound: (p: string) => `見つかりません: ${p}`,
    outsideRoots: (p: string) => `許可フォルダの外です: ${p}`,
    notFile: (p: string) => `${p}（ファイルではありません）`,
    overLimit: (p: string, mb: number) => `${p}（${mb}MB を超えています）`,
    overTotal: (p: string) => `${p}（合計 8MB を超えるため）`,
    binary: (p: string) => `${p}（バイナリファイル）`,
    system: (maxChars: number) => [
      "あなたは別の AI アシスタントから作業を任された担当者です。依頼者はあなたの出力だけを読みます。",
      `出力は ${maxChars} 文字以内に収め、結論と要点を先に書いてください。`,
      "根拠にした資料があればファイル名を示し、推測と事実を区別してください。依頼の言語で回答してください。"
    ].join("\n"),
    emptyInstructions: "instructions が空です",
    unknownPrice: (model: string) => `${model} の料金が分からず、1回あたりの上限を確かめられないため実行しませんでした。料金の分かるモデル（例：claude-opus-5-5）を指定してください。`,
    overBudget: (worst: string, cap: string, tokens: string) => `見積もり上限 ${worst} が 1回あたりの上限 ${cap} を超えるため実行しませんでした（入力 ${tokens} トークン）。ファイルを減らすか CONTINUITY_MCP_MAX_USD_PER_CALL を上げてください。`
  },
  server: {
    creditUnset: "今月のクレジット: 未設定（Claude Continuity アプリで設定できます）",
    creditSpent: (usd: string) => `今月の推定利用額: ${usd}`,
    creditRemaining: (remaining: string, monthly: string, days: number) => `今月の残額（推定）: ${remaining} / ${monthly} · 失効まで ${days}日`,
    delegateTitle: "API に作業を任せる",
    delegateDescription: "重い読み込みや長い推論を、Max プランの月間 API クレジットで別の Claude に任せ、要約だけを受け取ります。" +
      "大きなファイルは本文を渡さず files にパスを指定してください（サーバーが直接読みます）。" +
      "instructions には目的・前提・出力形式を書いてください。担当者はこの会話を見ていません。",
    params: {
      instructions: "目的・前提・欲しい出力形式を含む依頼文",
      files: "読ませたいローカルファイルの絶対パス（許可フォルダ内のテキスト・PDF）",
      model: "使うモデル ID（省略時は CONTINUITY_MCP_MODEL）",
      effort: "思考の深さ",
      maxResultChars: "返す結果の最大文字数（既定 6000）",
      saveFullResult: "全文をファイルに保存し、そのパスも返す"
    },
    noApiKey: "ANTHROPIC_API_KEY が設定されていません。",
    estimated: (usd: string) => ` · 推定 ${usd}`,
    read: (list: string) => `読み込み: ${list}`,
    skipped: (list: string) => `スキップ: ${list}`,
    truncated: (chars: number, saved: boolean) => `（結果を ${chars} 文字で切り詰めました${saved ? "" : "。全文が必要なら save_full_result を指定してください"}）`,
    fullText: (p: string) => `全文: ${p}`,
    failed: (message: string) => `実行できませんでした: ${message}`,
    creditTitle: "月間クレジットの残額",
    creditDescription: "Claude Continuity が記録した利用量から、今月の API クレジットの推定残額・失効日・1日の目安を返します。",
    creditNotConfigured: "クレジットが未設定です。Claude Continuity アプリの初期設定でプランと付与日を設定してください。",
    pace: { under: "余りそう", on: "順調", over: "使いすぎ" },
    planLabels: { max5x: "Max 5x", max20x: "Max 20x", team: "Team", custom: "カスタム", none: "対象外" },
    plan: (label: string) => `プラン: ${label}`,
    planMonthly: (label: string, monthly: string) => `プラン: ${label}（月 ${monthly}）`,
    remaining: (remaining: string, spent: string) => `推定残額: ${remaining}（推定使用 ${spent}）`,
    cycle: (start: string, end: string, days: number) => `サイクル: ${start} 〜 ${end} · 失効まで ${days}日`,
    paceLine: (pace: string, daily: string) => `ペース: ${pace} · 使い切るには 1日あたり ${daily}`,
    calibrated: "Console の残高で補正済み",
    estimateNote: "推定値です。正確な残高は Console の Billing で確認してください"
  }
};
