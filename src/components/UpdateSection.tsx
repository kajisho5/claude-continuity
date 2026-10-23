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
  return <div className="update-section m-[0_0_18px] rounded-[12px] border border-line-strong bg-surface px-[16px] py-[14px]">
    <div className="update-row flex items-center justify-between gap-[12px] text-[13px] text-ink-3"><span>バージョン <b className="font-semibold text-ink">{version || "…"}</b></span>
      {status.state === "available" ? <button className="btn-primary small" onClick={() => void window.continuity.downloadUpdate()}><Download size={13} />ダウンロード</button>
        : status.state === "ready" ? <button className="btn-primary small" onClick={() => void window.continuity.installUpdate()}><RotateCw size={13} />再起動して更新</button>
          : <button className="btn-secondary small" disabled={status.state === "checking" || status.state === "downloading"} onClick={() => void window.continuity.checkForUpdates()}>
            <RefreshCw size={13} className={status.state === "checking" ? "spin animate-spin" : ""} />更新を確認</button>}
    </div>
    {statusText(status) && <p className={"muted update-text m-[10px_0_0]" + (status.state === "error" ? " error text-warn" : "")}>{statusText(status)}</p>}
    {status.state === "downloading" && <span className="update-progress wide mt-[8px] block h-[6px] w-full shrink-0 overflow-hidden rounded-[3px] bg-line"><i className="block h-full bg-accent transition-[width] duration-300 ease-[ease]" style={{ width: `${status.percent}%` }} /></span>}
    {(status.state === "available" || status.state === "ready") && status.notes && <details className="update-notes mt-[10px]" open><summary className="cursor-pointer text-[12px] text-muted">変更内容</summary><pre className="m-[6px_0_0] max-h-[200px] overflow-auto font-sans text-[12px] leading-[1.7] font-normal whitespace-pre-wrap text-ink-4">{status.notes}</pre></details>}
    <p className="muted m-[8px_0_0] text-[11px] text-subtle">起動時と数時間ごとに新しいバージョンを確認し、見つかったら通知します（設定 →「一般」でオフにできます）。ダウンロードと再起動は、ボタンを押したときだけ行います。</p>
  </div>;
}
