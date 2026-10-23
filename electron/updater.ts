import { app, ipcMain, type BrowserWindow } from "electron";
import { autoUpdater, type AppUpdater } from "electron-updater";

export type UpdateStatus =
  | { state: "idle" | "checking" | "none" }
  | { state: "available" | "ready"; version: string }
  | { state: "downloading"; version: string; percent: number }
  | { state: "error"; message: string };

const message = (error: unknown) => String((error as Error)?.message ?? error).slice(0, 300);

/**
 * Updates come from this repository's GitHub Releases (latest.yml published next to the installer).
 * Nothing downloads or installs without the user pressing a button; development runs never check.
 */
export function setupUpdater(getWindow: () => BrowserWindow | null) {
  let status: UpdateStatus = { state: "idle" };
  let version = "";
  const emit = (next: UpdateStatus) => {
    status = next;
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send("update:status", status);
  };
  // Handlers are registered first so the UI works even when the updater cannot start in this environment.
  let updater: AppUpdater | null = null;
  const check = async () => {
    if (!app.isPackaged) { emit({ state: "error", message: "開発版では更新を確認しません。" }); return status; }
    if (!updater) { emit({ state: "error", message: "この環境では自動更新を利用できません。" }); return status; }
    try {
      // null means the updater is inactive for this build (e.g. an unpacked folder rather than an installer).
      const result = await updater.checkForUpdates();
      if (!result) emit({ state: "error", message: "この配布形式では自動更新を利用できません。インストーラー版をお使いください。" });
    } catch (error) { emit({ state: "error", message: message(error) }); }
    return status;
  };
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("update:status", () => status);
  ipcMain.handle("update:check", () => check());
  ipcMain.handle("update:download", async () => { if (updater && status.state === "available") await updater.downloadUpdate(); return status; });
  ipcMain.handle("update:install", () => { if (updater && status.state === "ready") updater.quitAndInstall(false, true); return status; });
  if (!app.isPackaged) return;
  try {
    updater = autoUpdater;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.on("checking-for-update", () => emit({ state: "checking" }));
    updater.on("update-not-available", () => emit({ state: "none" }));
    updater.on("update-available", info => { version = info.version; emit({ state: "available", version }); });
    updater.on("download-progress", p => emit({ state: "downloading", version, percent: Math.round(p.percent) }));
    updater.on("update-downloaded", info => emit({ state: "ready", version: info.version }));
    updater.on("error", error => emit({ state: "error", message: message(error) }));
  } catch (error) {
    updater = null;
    status = { state: "error", message: message(error) };
    return;
  }
  // A quiet check shortly after launch; failures (offline, no release yet) only show in Settings.
  setTimeout(() => { void check(); }, 15_000);
}
