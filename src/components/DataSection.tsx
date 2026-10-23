import { useEffect, useState } from "react";
import { ArchiveRestore, Download, FolderOpen } from "lucide-react";
import { ConfirmDialog } from "./Dialog";
import { useT } from "../i18n";

type Notice = (text: string, kind?: "ok" | "error") => void;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

/** Backup / restore of the local data folder. Restoring reloads the window so every view re-reads the files. */
export default function DataSection({ onNotice }: { onNotice: Notice }) {
  const t = useT();
  const d = t.settings.data;
  const [dataDir, setDataDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { window.continuity.mcpInfo().then(info => setDataDir(info.dataDir)).catch(() => {}); }, []);
  async function backup() {
    setBusy(true);
    try {
      const result = await window.continuity.backupData();
      if (!result.canceled) onNotice(d.backedUp(result.count));
    } catch (e) { onNotice(d.backupFailed + message(e), "error"); }
    finally { setBusy(false); }
  }
  async function restore() {
    setBusy(true);
    try {
      const result = await window.continuity.restoreData();
      if (result.canceled) return;
      onNotice(d.restored(result.count));
      window.setTimeout(() => window.location.reload(), 900);
    } catch (e) { onNotice(d.restoreFailed + message(e), "error"); }
    finally { setBusy(false); }
  }
  return <>
    <h3 className="m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">{d.backup}</h3>
    <p className="muted">{d.backupIntro}</p>
    <p className="muted">{d.backupNoKey}</p>
    <div className="form-actions start"><button className="btn-primary" disabled={busy} onClick={() => void backup()}><Download size={14} />{d.createBackup}</button></div>
    <h3 className="spaced m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink mt-[26px]">{d.restore}</h3>
    <p className="muted">{d.restoreIntro}</p>
    <div className="form-actions start"><button className="btn-secondary" disabled={busy} onClick={() => setConfirm(true)}><ArchiveRestore size={14} />{d.pickZip}</button></div>
    <h3 className="spaced m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink mt-[26px]">{d.location}</h3>
    <p className="muted">{d.locationIntro}</p>
    <div className="path-row mt-[8px] flex items-center gap-[10px] rounded-[9px] border border-line bg-inset py-[8px] pr-[8px] pl-[12px]"><code className="min-w-0 flex-1 font-mono text-[11.5px] leading-[normal] font-normal [overflow-wrap:anywhere] text-ink-4">{dataDir || "…"}</code>
      <button className="btn-secondary small" onClick={() => void window.continuity.openDataFolder().catch(e => onNotice(d.openFolderFailed + message(e), "error"))}><FolderOpen size={13} />{d.open}</button></div>
    {confirm && <ConfirmDialog title={d.confirmTitle} confirm={d.confirmButton}
      body={d.confirmBody}
      onConfirm={() => void restore()} onClose={() => setConfirm(false)} />}
  </>;
}
