/** Strings used by the Electron main process. Japanese is the source of truth; `en.ts` is typed against it. */
export const ja = {
  attachments: {
    badId: "添付ファイルの ID が正しくありません。",
    empty: (name: string) => `${name} は空のファイルです。`,
    tooLarge: (name: string) => `${name} は大きすぎます（上限 32MB）。`,
    imageTooLarge: (name: string) => `${name} は画像の上限 10MB を超えています。`,
    textTooLarge: (name: string) => `${name} はテキストの上限 2MB を超えています。`,
    notFile: (name: string) => `${name} はファイルではありません。`
  },
  backup: {
    notBackup: "Claude Continuity のバックアップファイルではありません。",
    unsupportedFormat: "このバックアップ形式には対応していません。アプリを更新してください。",
    unexpectedFile: (name: string) => `バックアップに想定外のファイルが含まれています: ${name}`,
    fileTooLarge: (rel: string) => `ファイルが大きすぎます: ${rel}`,
    totalTooLarge: "バックアップ全体が大きすぎます（上限 2GB）。",
    corrupt: (rel: string) => `${rel} が壊れています。`,
    badPath: (rel: string) => `不正なパス: ${rel}`
  },
  connectors: {
    nameRequired: "名前を入力してください。",
    badUrl: "URL の形式が正しくありません。",
    httpsOnly: "URL は https:// で始まる必要があります（API が接続できるのは公開された HTTPS の MCP サーバーだけです）。",
    noCredentialsInUrl: "URL に認証情報を含めないでください。トークン欄を使ってください。",
    notFound: "コネクタが見つかりません。",
    tokenStorageUnavailable: "この環境ではトークンを安全に保存できません。",
    connectFailed: (message: string) => `接続できませんでした: ${message}`
  },
  memory: {
    viewTruncated: "\n…（長いため省略。view_range で続きを表示してください）"
  },
  pastChats: {
    toolDescription: "ユーザーの過去の会話（このアプリに保存された履歴）をキーワードで検索し、該当する会話のタイトル・日付・抜粋を返します。ユーザーが以前の話題・決定事項・成果物に触れたとき、または過去の文脈が役立つときに使ってください。",
    queryDescription: "探したい内容のキーワード（複数ある場合は空白区切り）",
    maxResultsDescription: "返す会話の最大件数（1〜10、既定 5）",
    noHits: "該当する過去の会話は見つかりませんでした。",
    hitHeading: (n: number, title: string, date?: string) => `${n}. 「${title}」${date ? `（${date}）` : ""}`
  },
  request: {
    stylePrompts: {
      concise: "回答は簡潔にしてください。結論と要点を先に述べ、前置き・繰り返し・不要な補足は省いてください。",
      detailed: "回答は詳しくしてください。背景、根拠、具体例、注意点まで含めて丁寧に説明してください。",
      explanatory: "教える口調で説明してください。専門用語は噛み砕き、前提から段階を追って理解できるようにしてください。"
    },
    userName: (name: string) => `ユーザーの呼び名: ${name}`,
    userPreferences: (text: string) => `ユーザーが全会話で考慮してほしいこと:\n${text}`,
    aboutUser: (lines: string) => `# ユーザーについて\n${lines}`,
    projectInstructions: (name: string, text: string) => `# プロジェクト「${name}」の指示\n${text}`,
    imageUnsupported: (name: string) => `${name}（このモデルは画像に未対応）`,
    pdfUnsupported: (name: string) => `${name}（このモデルは PDF に未対応）`,
    fileNeedsCode: (name: string) => `${name}（「データ分析」か「ファイル作成」をオンにすると読み込めます）`,
    attachmentsOnly: "（添付ファイルのみ）",
    unavailable: { webSearch: "Web 検索", webFetch: "URL の読み込み", files: "ファイル作成", analysis: "データ分析" },
    activity: {
      webSearch: "Web を検索しています…",
      webFetch: "ページを読み込んでいます…",
      code: "コードを実行しています…",
      memory: "メモリを確認しています…",
      pastChats: "過去の会話を探しています…"
    },
    clipped: "\n…（以下略）",
    textEditorLabels: { view: "ファイルを表示", create: "ファイルを作成", str_replace: "ファイルを編集", insert: "ファイルに追記" } as Record<string, string>,
    memoryLabels: { view: "メモリを確認", create: "メモリに保存", str_replace: "メモリを更新", insert: "メモリに追記", delete: "メモリを削除", rename: "メモリの名前を変更" } as Record<string, string>,
    connector: "コネクタ",
    searchLabel: (query: string) => `「${query}」を検索`,
    error: (code: string) => `エラー: ${code}`,
    resultCount: (n: number) => `${n} 件の結果`,
    fetchLabel: "ページを読み込み",
    codeLabel: "コードを実行",
    exitCode: (code: number) => `終了コード ${code}`,
    fileOp: "ファイル操作",
    memoryOp: "メモリ操作",
    historySearch: (query: string) => `過去の会話から「${query}」を検索`,
    tool: "ツール"
  },
  updater: {
    devBuild: "開発版では更新を確認しません。",
    unavailable: "この環境では自動更新を利用できません。",
    unsupportedFormat: "この配布形式では自動更新を利用できません。インストーラー版をお使いください。",
    availableTitle: "Claude Continuity のアップデートがあります",
    availableBody: (version: string) => `バージョン ${version} をダウンロードできます。クリックしてアプリを開いてください。`,
    readyTitle: "アップデートの準備ができました",
    readyBody: (version: string) => `再起動するとバージョン ${version} になります。`
  },
  main: {
    importedChat: "インポートした会話",
    exportHtmlTitle: "会話を HTML で書き出す",
    exportJsonTitle: "会話をJSONでエクスポート",
    importTitle: "Claudeのエクスポートデータを選択",
    allFiles: "すべてのファイル",
    jsonTooLarge: "JSONファイルが大きすぎます（上限50MB）。",
    badChats: "会話データの形式が正しくありません。",
    chat: "会話",
    backupTitle: "すべてのデータをバックアップ",
    restoreTitle: "バックアップから復元",
    backupFileTooLarge: "バックアップファイルが大きすぎます（上限 2GB）。",
    zipOpenFailed: "ZIP ファイルを開けませんでした。",
    mcpFolderTitle: "MCP サーバーに読ませてよいフォルダ",
    keyStorageUnavailable: "この環境では安全なキー保存を利用できません。",
    badKey: "Anthropic APIキーの形式を確認してください。",
    secureStorageUnavailable: "安全なキー保存が利用できません。",
    badKeyPrefix: "Anthropic APIキーの形式を確認してください（sk-ant- で始まります）。",
    badCredit: "クレジット設定の形式が正しくありません。",
    badPlan: "プランの値が正しくありません。",
    badAmount: "月間付与額は 0〜10,000 USD で入力してください。",
    badResetDay: "付与日は 1〜31 で入力してください。",
    badCalibration: "補正値が正しくありません。",
    styleName: (n: number) => `スタイル ${n}`,
    customStyleName: "カスタム",
    badProjects: "プロジェクトの形式が正しくありません。",
    project: "プロジェクト",
    attachTitle: "ファイルを添付",
    notPdf: "PDF ファイルではありません。",
    badFileId: "ファイル ID が正しくありません。",
    saveFileTitle: "生成されたファイルを保存",
    noTurns: "送信する会話がありません。",
    noUserMessage: "ユーザーのメッセージがありません。",
    externalTool: "外部ツール",
    usingConnector: (name: string) => `コネクタ（${name}）を使っています…`,
    noticeOmitted: (n: number) => `古いやり取り ${n} 件はモデルの上限のため送っていません`,
    noticeSkipped: (detail: string) => `添付をスキップ: ${detail}`,
    noticeUnavailable: (feature: string) => `${feature}はこのモデルでは使えません`,
    handoffSystem: `あなたは会話の引き継ぎメモを書く担当です。渡された会話記録を読み、別の Claude がこのメモだけで作業を続けられるように、日本語で次の見出しの順にまとめてください。
## 目的
## これまでに決まったこと・前提
## 現在の状態（直近の成果物や結論。重要なコード・数値・固有名詞は省略しない）
## 未解決の点・次にやること
最後の行に「上記を踏まえて続きを手伝ってください。」と書いてください。全体で 2,500 文字以内。会話にない事実を足さないこと。`,
    handoffUser: (title: string, transcript: string) => `会話タイトル: ${title}\n\n<conversation>\n${transcript}\n</conversation>`,
    handoffIntro: (title: string, text: string) => `これは別のアプリ（Claude API）で続けていた会話「${title}」の引き継ぎメモです。\n\n${text}`,
    handoffEmpty: "引き継ぐ内容が空です。",
    handoffTooLong: "内容が長すぎます。短くしてから開いてください。",
    sampleTooShort: "サンプルの文章が短すぎます（40文字以上）。",
    styleFromSampleSystem: "渡された文章サンプルの書き方（語調、文の長さ、構成、記号や箇条書きの使い方、専門用語の扱い、読者との距離感）を分析し、別の AI がその書き方を再現するための指示文を日本語で書いてください。内容や固有の事実には触れず、書き方だけを、命令形の箇条書き 5〜10 項目で出力してください。前置きは不要です。",
    titleSystem: "会話の内容を表す日本語のタイトルを20文字以内で1つだけ出力してください。記号や引用符、説明は不要です。",
    titleUser: (user: string, assistant: string) => `ユーザー: ${user}\n\nアシスタント: ${assistant}`
  }
};
