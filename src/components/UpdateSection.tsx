import { useEffect, useState } from "react";
import { Download, RefreshCw, RotateCw } from "lucide-react";
import type { UpdateStatus as Status } from "../lib/update";


export function statusText(status: Status): string {
  switch (status.state) {
    default: return "";
    case "checking": return "更新を確認しています…";
    case "none": return "最新のバージョンです。";
    case "available": return `新しいバージョン ${status.version} があります。`;
    case "downloading": return `${status.version} をダウンロード中… ${status.percent}%`;
    case "ready": return `${status.version} の準備ができました。再起動すると更新されます。`;
    case "error": return `更新を確認できませんでした: ${status.message}`;
  }
}

/** Version and manual update controls for Settings → このアプリについて. */
export default function UpdateSection() {
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  useEffect(() => {
    window.continuity.appVersion().then(setVersion).catch(() => {});
    window.continuity.updateStatus().then(setStatus).catch(() => {});
    return window.continuity.onUpdateStatus(setStatus);
  }, []);
  return <div className="update-section">
    <div className="update-row"><span>バージョン <b>{version || "…"}</b></span>
      {status.state === "available" ? <button className="btn-primary small" onClick={() => void window.continuity.downloadUpdate()}><Download size={13} />ダウンロード</button>
        : status.state === "ready" ? <button className="btn-primary small" onClick={() => void window.continuity.installUpdate()}><RotateCw size={13} />再起動して更新</button>
          : <button className="btn-secondary small" disabled={status.state === "checking" || status.state === "downloading"} onClick={() => void window.continuity.checkForUpdates()}>
            <RefreshCw size={13} className={status.state === "checking" ? "spin" : ""} />更新を確認</button>}
    </div>
    {statusText(status) && <p className={"muted update-text" + (status.state === "error" ? " error" : "")}>{statusText(status)}</p>}
    {status.state === "downloading" && <span className="update-progress wide"><i style={{ width: `${status.percent}%` }} /></span>}
    {(status.state === "available" || status.state === "ready") && status.notes && <details className="update-notes" open><summary>変更内容</summary><pre>{status.notes}</pre></details>}
    <p className="muted">起動時と数時間ごとに新しいバージョンを確認し、見つかったら通知します（設定 →「一般」でオフにできます）。ダウンロードと再起動は、ボタンを押したときだけ行います。</p>
  </div>;
}
