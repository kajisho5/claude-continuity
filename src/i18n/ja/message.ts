export const message = {
  attachmentKind: { image: "画像", pdf: "PDF", text: "テキスト", file: "ファイル" },
  couldNotLoad: "読み込めませんでした。",
  truncatedLong: "\n\n…（長いため以降は省略）",
  clickToView: (name: string) => `${name}（クリックで表示）`,
  view: (name: string) => `${name} を表示`,
  remove: (name: string) => `${name} を外す`,
  editMessage: "メッセージを編集",
  editHint: "送信すると新しい版として回答を作ります。前の版とその回答は「< 1/2 >」で切り替えて見られます。",
  saveAndSend: "保存して送信",
  prevVersion: "前の版",
  nextVersion: "次の版",
  stoppedPartway: "応答を途中で停止しました",
  continue: "続ける",
  createdByClaude: "Claude が作成",
  sources: "出典",
  regenerate: "再生成",
  prevAnswer: "前の回答",
  nextAnswer: "次の回答",
  // MessageContent
  artifactMeta: (kind: string, lines: number) => `${kind} · ${lines} 行 · クリックして開く`,
  hideCode: "コードを隠す",
  showCode: "コードを表示",
  thinkingLive: "考えています…",
  thoughtFor: (seconds: number) => `${seconds}秒間考えました`,
  thinkingProcess: "思考プロセス",
  // StepsBlock
  steps: {
    search: (n: number) => `検索 ${n} 回`,
    fetch: (n: number) => `ページ読込 ${n} 件`,
    code: (n: number) => `コード実行 ${n} 回`,
    memory: (n: number) => `メモリ ${n} 回`,
    history: (n: number) => `過去の会話を検索 ${n} 回`,
    connector: (n: number) => `コネクタ ${n} 回`,
    other: (n: number) => `その他 ${n} 回`,
    hasErrors: "エラーあり",
    error: "エラー"
  }
};
