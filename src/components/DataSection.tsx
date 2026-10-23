import { useEffect, useState } from "react";
import { ArchiveRestore, Download, FolderOpen } from "lucide-react";
import { ConfirmDialog } from "./Dialog";

type Notice = (text: string, kind?: "ok" | "error") => void;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

/** Backup / restore of the local data folder. Restoring reloads the window so every view re-reads the files. */
export default function DataSection({ onNotice }: { onNotice: Notice }) {
  const [dataDir, setDataDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { window.continuity.mcpInfo().then(info => setDataDir(info.dataDir)).catch(() => {}); }, []);
  async function backup() {
    setBusy(true);
    try {
      const result = await window.continuity.backupData();
      if (!result.canceled) onNotice(`${result.count} 個のファイルをバックアップしました`);
    } catch (e) { onNotice("バックアップに失敗しました: " + message(e), "error"); }
    finally { setBusy(false); }
  }
  async function restore() {
    setBusy(true);
    try {
      const result = await window.continuity.restoreData();
      if (result.canceled) return;
      onNotice(`復元しました（${result.count} 個のファイル）。再読み込みします…`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (e) { onNotice("復元できませんでした: " + message(e), "error"); }
    finally { setBusy(false); }
  }
  return <>
    <h3>バックアップ</h3>
    <p className="muted">会話・プロジェクト・添付ファイル・メモリ・設定・使用量の記録を 1 つの ZIP にまとめます。別の PC への引っ越しにも使えます。</p>
    <p className="muted">API キーは含めません（この PC 専用の暗号化で保存しているため）。復元先で設定し直してください。</p>
    <div className="form-actions start"><button className="btn-primary" disabled={busy} onClick={() => void backup()}><Download size={14} />バックアップを作成</button></div>
    <h3 className="spaced">バックアップから復元</h3>
    <p className="muted">いまのデータをバックアップの内容で置き換えます。置き換える前の状態は自動で保存されるので、間違えても戻せます。</p>
    <div className="form-actions start"><button className="btn-secondary" disabled={busy} onClick={() => setConfirm(true)}><ArchiveRestore size={14} />ZIP を選んで復元…</button></div>
    <h3 className="spaced">保存場所</h3>
    <p className="muted">データはこの PC の次のフォルダにだけ保存されます。クラウドには同期しません。</p>
    <div className="path-row"><code>{dataDir || "…"}</code>
      <button className="btn-secondary small" onClick={() => void window.continuity.openDataFolder().catch(e => onNotice("フォルダを開けませんでした: " + message(e), "error"))}><FolderOpen size={13} />開く</button></div>
    {confirm && <ConfirmDialog title="バックアップから復元しますか？" confirm="ZIP を選ぶ"
      body="いまの会話・プロジェクト・設定などが、選んだバックアップの内容に置き換わります。置き換える前の状態は自動で保存されます。"
      onConfirm={() => void restore()} onClose={() => setConfirm(false)} />}
  </>;
}
