import { app, ipcMain, Notification, type BrowserWindow } from "electron";
import { autoUpdater, type AppUpdater } from "electron-updater";
import { mainT } from "./i18n";

export type UpdateStatus =
  | { state: "idle" | "checking" | "none" }
  | { state: "available" | "ready"; version: string; notes?: string }
  | { state: "downloading"; version: string; percent: number }
  | { state: "error"; message: string };

const message = (error: unknown) => String((error as Error)?.message ?? error).slice(0, 300);
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Release notes arrive as HTML (GitHub) or a list of versions; keep plain text for the UI. */
export function notesText(notes: unknown): string | undefined {
  const raw = Array.isArray(notes) ? notes.map(n => (n && typeof n === "object" && "note" in n ? String((n as { note: unknown }).note ?? "") : "")).join("\n") : typeof notes === "string" ? notes : "";
  const text = raw.replace(/<li[^>]*>/gi, "- ").replace(/<br\s*\/?>|<\/(p|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
  return text ? text.slice(0, 2000) : undefined;
}

/**
 * Updates come from this repository's GitHub Releases (latest.yml published next to the installer).
 * Nothing downloads or installs without the user pressing a button; development runs never check.
 */
export function setupUpdater(getWindow: () => BrowserWindow | null, opts: { enabled: () => Promise<boolean> }) {
  let status: UpdateStatus = { state: "idle" };
  let version = "";
  let notes: string | undefined;
  const notified = new Set<string>();
  // OS notification when the window is in the background; clicking brings the app (and its update banner) forward.
  const notify = (key: string, title: string, body: string) => {
    const win = getWindow();
    if (notified.has(key) || !Notification.isSupported() || (win && win.isFocused())) return;
    notified.add(key);
    const note = new Notification({ title, body });
    note.on("click", () => { const w = getWindow(); if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); } });
    note.show();
  };
  const emit = (next: UpdateStatus) => {
    status = next;
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send("update:status", status);
  };
  // Handlers are registered first so the UI works even when the updater cannot start in this environment.
  let updater: AppUpdater | null = null;
  const check = async (automatic = false) => {
    if (automatic && !(await opts.enabled())) return status;
    if (!app.isPackaged) { emit({ state: "error", message: mainT().updater.devBuild }); return status; }
    if (!updater) { emit({ state: "error", message: mainT().updater.unavailable }); return status; }
    try {
      // null means the updater is inactive for this build (e.g. an unpacked folder rather than an installer).
      const result = await updater.checkForUpdates();
      if (!result) emit({ state: "error", message: mainT().updater.unsupportedFormat });
    } catch (error) { emit({ state: "error", message: message(error) }); }
    return status;
  };
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("update:status", () => status);
  ipcMain.handle("update:check", () => check(false));
  ipcMain.handle("update:download", async () => { if (updater && status.state === "available") await updater.downloadUpdate(); return status; });
  ipcMain.handle("update:install", () => { if (updater && status.state === "ready") updater.quitAndInstall(false, true); return status; });
  if (!app.isPackaged) return;
  try {
    updater = autoUpdater;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.on("checking-for-update", () => emit({ state: "checking" }));
    updater.on("update-not-available", () => emit({ state: "none" }));
    updater.on("update-available", info => {
      version = info.version; notes = notesText(info.releaseNotes);
      emit({ state: "available", version, ...(notes ? { notes } : {}) });
      notify(`available-${version}`, mainT().updater.availableTitle, mainT().updater.availableBody(version));
    });
    updater.on("download-progress", p => emit({ state: "downloading", version, percent: Math.round(p.percent) }));
    updater.on("update-downloaded", info => {
      emit({ state: "ready", version: info.version, ...(notes ? { notes } : {}) });
      notify(`ready-${info.version}`, mainT().updater.readyTitle, mainT().updater.readyBody(info.version));
    });
    updater.on("error", error => emit({ state: "error", message: message(error) }));
  } catch (error) {
    updater = null;
    status = { state: "error", message: message(error) };
    return;
  }
  // Quiet checks shortly after launch and then every few hours; failures (offline, no release yet) only show in Settings.
  setTimeout(() => { void check(true); }, 15_000);
  setInterval(() => { if (status.state !== "downloading" && status.state !== "ready") void check(true); }, CHECK_INTERVAL_MS);
}
