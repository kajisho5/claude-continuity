// Used by the artifact runtime bundle (src/artifact-runtime), which imports this file directly.
export const runtime = {
  renderError: "実行中にエラーが起きました",
  compileError: "コードを読み込めませんでした",
  executeError: "コードの実行に失敗しました",
  noComponent: "表示するコンポーネントがありません",
  noComponentDetail: "export default で React コンポーネントを書き出してください。",
  unsupportedImport: (name: string) => `「${name}」は使えません（使えるのは react / lucide-react / recharts です）`
};
