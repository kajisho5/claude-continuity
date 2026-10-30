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
  localMcp: {
    inputCut: (n: number) => `（ほか ${n.toLocaleString("ja-JP")} 文字は省略）`,
    commandRequired: "コマンドを入力してください。",
    badEnv: (key: string) => `環境変数の名前が正しくありません: ${key}`,
    truncated: "\n…（長いため省略）",
    emptyResult: "（結果なし）",
    startTimeout: "60 秒以内に起動しませんでした。",
    startFailed: (name: string, message: string, stderr: string) => `${name} を起動できませんでした: ${message}${stderr ? `\n${stderr}` : ""}`,
    denied: "ユーザーがこのツールの実行を許可しませんでした。",
    callFailed: (message: string) => `ツールの実行に失敗しました: ${message}`,
    unavailable: (name: string, message: string) => `ローカル MCP サーバー「${name}」を使えませんでした（${message}）`,
    configNotFound: (file: string) => `Claude Desktop の設定ファイルが見つかりません: ${file}`,
    configInvalid: "Claude Desktop の設定ファイルを読み取れませんでした（JSON の形式が正しくありません）。",
    envStorageUnavailable: "この環境では環境変数を安全に保存できません。",
    starting: (name: string) => `${name} を起動しています…`,
    usingTool: (server: string, tool: string) => `${server} の ${tool} を使っています…`,
    waitingApproval: (server: string, tool: string) => `${server} の ${tool} の実行許可を待っています…`
  },
  skills: {
    pickTitle: "スキルを選ぶ（SKILL.md のあるフォルダ、または .zip）",
    unsupported: "スキルのフォルダ、SKILL.md、または .zip / .skill ファイルを選んでください。",
    noSkillMd: "SKILL.md が見つかりません。スキルのフォルダの一番上に SKILL.md が必要です。",
    tooLarge: "スキルが大きすぎます（合計 30MB まで）。",
    tooManyFiles: "ファイルが多すぎます（500 個まで）。",
    badArchive: "この .zip は安全に読み込めません（フォルダの外を指すパスが含まれています）。"
  },
  knowledge: {
    toolDescription: "このプロジェクトのナレッジ（登録されたテキスト資料）を検索し、関連する箇所を返します。ナレッジは大きいため会話には全文を入れていません。資料の内容に関わる質問では、答える前にこのツールで調べ、必要なら言葉を変えて何度か検索してください。",
    queryDescription: "探したい内容のキーワードや短い文",
    maxResultsDescription: "返す箇所の最大数（1〜12、既定 6）",
    noHits: "該当する箇所は見つかりませんでした。別の言葉で検索してみてください。",
    hitHeading: (name: string, part: number) => `【${name} · 第 ${part} 部分】`,
    systemNote: (names: string) => `# プロジェクトのナレッジ\n次の資料は大きいため全文を送っていません。内容が必要なときは search_project_knowledge で検索してください:\n${names}`
  },
  memory: {
    viewTruncated: "\n…（長いため省略。view_range で続きを表示してください）"
  },
  pastChats: {
    toolDescription: "ユーザーの過去の会話（このアプリに保存された履歴）をキーワードで検索し、該当する会話のタイトル・日付・抜粋を返します。ユーザーが「前に話した」「以前の会話」のように過去の会話をはっきり参照したときだけ使ってください。それ以外の質問では使わず、そのまま答えてください。",
    queryDescription: "探したい内容のキーワード（複数ある場合は空白区切り）",
    maxResultsDescription: "返す会話の最大件数（1〜10、既定 5）",
    noHits: "該当する過去の会話は見つかりませんでした。",
    hitHeading: (n: number, title: string, date?: string) => `${n}. 「${title}」${date ? `（${date}）` : ""}`
  },
  request: {
    appContext: (on: string[], off: string[]) => [
      "# このアプリについて",
      "この会話は Claude Continuity（Anthropic API を使うデスクトップアプリ）で行われています。",
      "- ユーザーは入力欄の「＋」・ドラッグ＆ドロップ・貼り付けで、画像・PDF・テキスト・コードなどのファイルを添付でき、スクリーンショットも送れます。添付されたファイルはこの会話に届きます。",
      "- 入力欄のツールメニューで、ツールをオン／オフできます。",
      on.length ? `- この返信で使えるツール：${on.join("、")}` : "- この返信で使えるツールはありません。",
      off.length ? `- オフになっているツール：${off.join("、")}。これらが必要な依頼には「できない」と答えず、ツールメニューでオンにするよう案内してください。` : ""
    ].filter(Boolean).join("\n"),
    toolNames: { webSearch: "Web 検索", webFetch: "URL の読み込み", files: "ファイル作成（Skills）", analysis: "データ分析（コード実行）", research: "リサーチ", memory: "メモリ" },
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
    researchPrompt: [
      "# リサーチモード",
      "ユーザーはリサーチを依頼しています。Web 検索とページの読み込みを繰り返して、徹底的に調べてから答えてください。",
      "- 最初に、答えに必要な観点を洗い出し、観点ごとに検索の言葉を変えて複数回検索してください。",
      "- 検索結果の要約だけで判断せず、信頼できる一次情報（公式サイト、公式ドキュメント、論文、公的機関の資料など）のページを読み込んで中身を確かめてください。",
      "- 情報源どうしで食い違いがあれば、その旨と両方の内容を書いてください。確認できないことは推測で埋めず「確認できなかった」と書いてください。",
      "- 日付が重要な情報は、いつ時点の情報かを書いてください。",
      "- 調べ終えたら、見出し付きのレポートにまとめてください：冒頭に結論と要点、続いて観点ごとの詳細、最後に残る不確実な点。",
      "- 主張には出典を付けてください。"
    ].join("\n"),
    researchProgress: (searches: number, fetches: number) => `リサーチ中… 検索 ${searches} 回 · ページ ${fetches} 件`,
    unavailable: { research: "リサーチ", webSearch: "Web 検索", webFetch: "URL の読み込み", files: "ファイル作成", analysis: "データ分析" },
    activity: {
      webSearch: "Web を検索しています…",
      webFetch: "ページを読み込んでいます…",
      code: "コードを実行しています…",
      memory: "メモリを確認しています…",
      knowledge: "ナレッジを検索しています…",
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
    knowledgeSearch: (query: string) => `ナレッジを検索: ${query}`,
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
  compaction: {
    summarizing: "古いやり取りを要約しています…",
    attachments: (names: string) => `［添付: ${names}］`,
    start: "（会話の始まり）",
    system: "あなたは会話の記録係です。渡された会話（と、あればこれまでの要約）を、続きの会話に必要な情報が失われないように要約してください。目的、決まったこと、数値や固有名詞、ユーザーの好みや指示、未解決の点を残し、日本語の見出しと箇条書きで書いてください。前置きは不要です。",
    request: (previous: string, transcript: string) => `${previous ? `<previous_summary>\n${previous}\n</previous_summary>\n\n` : ""}<conversation>\n${transcript}\n</conversation>\n\n${previous ? "これまでの要約に、この続きの会話の内容を加えた" : "この会話の"}要約を書いてください。`,
    user: "ユーザー",
    assistant: "アシスタント",
    noticeSummarized: (n: number) => `古いやり取り ${n} 件は要約して送りました`
  },
  batch: {
    noLocal: (names: string) => `Batch ではこの PC で動くツールを使えないため外しました: ${names}`,
    noKnowledgeSearch: "Batch ではナレッジ検索を使えないため、大きなナレッジは送っていません",
    notFound: "この Batch は見つかりません。",
    expired: "24 時間以内に処理されませんでした（課金なし）",
    canceled: "キャンセルしました",
    errored: (message: string) => `処理できませんでした: ${message}`,
    notifyTitle: "Batch の返答が届きました",
    tooOld: "結果の保存期間（29 日）を過ぎました"
  },
  main: {
    shortcutTaken: (keys: string) => `${keys} はほかのアプリが使っているため登録できませんでした。別の組み合わせを選んでください。`,
    browserNoPage: "ブラウザでページを開いてから使ってください。",
    captureFailed: "画面を取り込めませんでした。macOS では、システム設定 →「プライバシーとセキュリティ」→「画面収録」でこのアプリを許可してください。",
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
    reloadingAfterRestore: "データを復元したため、画面を読み込み直しています。",
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
    noticeRoundFailed: (msg: string) => `途中のリクエストが失敗したため、回答はそこで止まっています（${msg}）。「続ける」で再開できます`,
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
