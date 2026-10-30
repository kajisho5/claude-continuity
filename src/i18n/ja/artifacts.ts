export const artifacts = {
  browser: {
    label: "ブラウザ",
    back: "戻る",
    forward: "進む",
    reload: "再読み込み",
    stop: "読み込みを止める",
    address: "URL または検索語",
    openExternal: "OS のブラウザで開く",
    empty: "URL を入力するか、返事の中のリンクをクリックしてください。",
    failed: (reason: string) => `ページを開けませんでした（${reason}）`,
    sendPage: "このページを Claude に渡す",
    sendCapture: "見えている部分を画像で渡す",
    attached: "入力欄に添付しました"
  },
  panel: {
    label: "アーティファクト",
    diagramFailed: "図を描けませんでした",
    drawingDiagram: "図を描いています…",
    preparingComponent: "コンポーネントを準備しています…",
    versions: "バージョン",
    previousVersion: "前のバージョン",
    nextVersion: "次のバージョン",
    preview: "プレビュー",
    code: "コード",
    sandboxHint: "sandbox 付き iframe で表示しています（ネットワーク・アプリ本体へのアクセスなし）",
    reactLibraries: " · 使えるライブラリ: React・lucide-react・recharts・Tailwind",
    saveAs: (ext: string) => `.${ext} で保存`
  },
  page: {
    title: "アーティファクト",
    search: "アーティファクトを検索",
    searchPlaceholder: "アーティファクトを検索…",
    emptyTitle: "まだアーティファクトはありません",
    emptyText: "Claude が HTML・SVG・図（Mermaid）・長めの文書（Markdown）を書くと、ここにまとまります。会話の中ではカードとして表示され、クリックすると右側で開きます。",
    noMatches: "一致するアーティファクトはありません。",
    versions: (n: number) => `${n} バージョン`
  }
};
