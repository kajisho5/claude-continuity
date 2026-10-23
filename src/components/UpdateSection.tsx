import { useEffect, useState } from "react";
import { Download, RefreshCw, RotateCw } from "lucide-react";
import type { UpdateStatus as Status } from "../lib/update";
import { t as messages, useT, type Messages } from "../i18n";


export function statusText(status: Status, t: Messages = messages()): string {
  const u = t.settings.update;
  switch (status.state) {
    default: return "";
    case "checking": return u.checking;
    case "none": return u.none;
    case "available": return u.available(status.version);
    case "downloading": return u.downloading(status.version, status.percent);
    case "ready": return u.ready(status.version);
    case "error": return u.error(status.message);
  }
}

/** Version and manual update controls for Settings → このアプリについて. */
export default function UpdateSection() {
  const t = useT();
  const u = t.settings.update;
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  useEffect(() => {
    window.continuity.appVersion().then(setVersion).catch(() => {});
    window.continuity.updateStatus().then(setStatus).catch(() => {});
    return window.continuity.onUpdateStatus(setStatus);
  }, []);
  return <div className="update-section m-[0_0_18px] rounded-[12px] border border-line-strong bg-surface px-[16px] py-[14px]">
    <div className="update-row flex items-center justify-between gap-[12px] text-[13px] text-ink-3"><span>{u.version} <b className="font-semibold text-ink">{version || "…"}</b></span>
      {status.state === "available" ? <button className="btn-primary small" onClick={() => void window.continuity.downloadUpdate()}><Download size={13} />{status.manual ? u.openPage : u.download}</button>
        : status.state === "ready" ? <button className="btn-primary small" onClick={() => void window.continuity.installUpdate()}><RotateCw size={13} />{u.restart}</button>
          : <button className="btn-secondary small" disabled={status.state === "checking" || status.state === "downloading"} onClick={() => void window.continuity.checkForUpdates()}>
            <RefreshCw size={13} className={status.state === "checking" ? "spin animate-spin" : ""} />{u.check}</button>}
    </div>
    {status.state === "available" && status.manual && <p className="muted update-manual m-[10px_0_0] text-[12px]">{u.manualHint}</p>}
    {statusText(status, t) && <p className={"muted update-text m-[10px_0_0]" + (status.state === "error" ? " error text-warn" : "")}>{statusText(status, t)}</p>}
    {status.state === "downloading" && <span className="update-progress wide mt-[8px] block h-[6px] w-full shrink-0 overflow-hidden rounded-[3px] bg-line"><i className="block h-full bg-accent transition-[width] duration-300 ease-[ease]" style={{ width: `${status.percent}%` }} /></span>}
    {(status.state === "available" || status.state === "ready") && status.notes && <details className="update-notes mt-[10px]" open><summary className="cursor-pointer text-[12px] text-muted">{u.notes}</summary><pre className="m-[6px_0_0] max-h-[200px] overflow-auto font-sans text-[12px] leading-[1.7] font-normal whitespace-pre-wrap text-ink-4">{status.notes}</pre></details>}
    <p className="muted m-[8px_0_0] text-[11px] text-subtle">{u.footnote}</p>
  </div>;
}
