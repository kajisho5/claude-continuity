export const dialogs = {
  shortcuts: {
    title: "キーボードショートカット",
    newChat: "新しい会話",
    searchChats: "会話を検索",
    focusInput: "入力欄へ移動",
    toggleSidebar: "サイドバーの開閉",
    send: "送信",
    newline: "改行",
    stopOrClose: "応答を停止 / パネルやダイアログを閉じる",
    showShortcuts: "このショートカット一覧"
  },
  rename: {
    title: "会話の名前を変更",
    label: "会話の名前"
  },
  handoff: {
    title: "Claude アプリで続ける",
    intro: "Claude デスクトップアプリの新しいチャットを、この会話の文脈を入力した状態で開きます。送信はアプリ側で内容を確認してから押してください。添付ファイルや作成したファイルは引き継がれません。",
    modeSummary: "要約して引き継ぐ（おすすめ）",
    modeTranscript: "最近のやり取りをそのまま",
    summaryExplain: "会話全体を API で引き継ぎメモにまとめます（目的・決定事項・現状・次にやること）。",
    summaryCost: (model: string) => `${model} を使い、API クレジットを少し使います。`,
    summarizing: "要約しています…",
    createSummary: "引き継ぎメモを作成",
    needsKey: "API キーを設定すると使えます。",
    contentLabel: "引き継ぐ内容",
    chars: (n: string) => `${n} 文字`,
    overWindows: " · Windows のリンク長の上限を超えるため末尾を省きます",
    over: " · 上限を超えるため末尾を省きます",
    included: (included: number, total: number) => `直近 ${included} / ${total} 件を含めています`,
    regenerating: "作成中…",
    regenerate: "作り直す",
    openWeb: "ブラウザの claude.ai で開く",
    openDesktop: "Claude デスクトップで開く",
    summaryFailed: (error: string) => "要約を作成できませんでした: " + error,
    copiedForWeb: "内容をコピーしました。claude.ai の入力欄に貼り付けて送信してください",
    openedDesktop: "Claude アプリを開きました。内容を確認して送信してください",
    openedClipped: "長すぎたため末尾を省いて開きました",
    openFailed: (error: string) => "開けませんでした: " + error
  }
};
