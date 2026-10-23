import path from "node:path";
import fs from "node:fs/promises";
import AdmZip from "adm-zip";
import { mainT } from "./i18n";

/** Everything in the data folder that a backup carries. The API key is device-bound (safeStorage) and is never included. */
export const BACKUP_FILES = ["chats.json", "usage.json", "usage-mcp.jsonl", "credit.json", "prefs.json", "projects.json"];
export const BACKUP_DIRS = ["attachments", "memories"];
const MANIFEST = "manifest.json";
const MAX_ENTRY_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

async function walk(dir: string, base: string, out: string[]) {
  let entries: import("node:fs").Dirent[];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    // Symlinks are skipped so a backup can never pull in files from outside the data folder.
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) await walk(full, base, out);
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
}

export async function createBackup(dataDir: string, appVersion: string): Promise<{ zip: AdmZip; count: number }> {
  const files: string[] = [];
  for (const name of BACKUP_FILES) { try { if ((await fs.lstat(path.join(dataDir, name))).isFile()) files.push(name); } catch {} }
  for (const dir of BACKUP_DIRS) await walk(path.join(dataDir, dir), dataDir, files);
  const zip = new AdmZip();
  for (const rel of files) zip.addFile(rel, await fs.readFile(path.join(dataDir, ...rel.split("/"))));
  zip.addFile(MANIFEST, Buffer.from(JSON.stringify({ app: "claude-continuity", format: 1, createdAt: new Date().toISOString(), appVersion, files: files.length }, null, 2)));
  return { zip, count: files.length };
}

/** Returns the normalized relative path when an archive entry is something a backup may contain, otherwise null. */
export function allowedEntry(name: string): string | null {
  const rel = name.replace(/\\/g, "/");
  if (rel.startsWith("/") || /^[a-zA-Z]:/.test(rel)) return null;
  const parts = rel.split("/");
  if (parts.some(p => p === "" || p === "." || p === "..")) return null;
  if (parts.length === 1) return BACKUP_FILES.includes(rel) ? rel : null;
  return BACKUP_DIRS.includes(parts[0]) ? rel : null;
}

/** Validates a backup archive and returns the entries to restore. Throws a user-facing message when it is not usable. */
export function readBackup(zip: AdmZip): { rel: string; data: Buffer }[] {
  const manifestEntry = zip.getEntry(MANIFEST);
  let manifest: any = null;
  try { manifest = manifestEntry ? JSON.parse(manifestEntry.getData().toString("utf8")) : null; } catch {}
  if (manifest?.app !== "claude-continuity") throw new Error(mainT().backup.notBackup);
  if (manifest.format !== 1) throw new Error(mainT().backup.unsupportedFormat);
  const out: { rel: string; data: Buffer }[] = [];
  let total = 0;
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || entry.entryName === MANIFEST) continue;
    const rel = allowedEntry(entry.entryName);
    if (!rel) throw new Error(mainT().backup.unexpectedFile(entry.entryName));
    if (entry.header.size > MAX_ENTRY_BYTES) throw new Error(mainT().backup.fileTooLarge(rel));
    total += entry.header.size;
    if (total > MAX_TOTAL_BYTES) throw new Error(mainT().backup.totalTooLarge);
    const data = entry.getData();
    if (rel.endsWith(".json") && !rel.includes("/")) {
      try { JSON.parse(data.toString("utf8")); } catch { throw new Error(mainT().backup.corrupt(rel)); }
    }
    out.push({ rel, data });
  }
  return out;
}

/** Replaces the backed-up parts of the data folder with the given entries. The API key file is left untouched. */
export async function restoreEntries(dataDir: string, entries: { rel: string; data: Buffer }[]) {
  for (const name of BACKUP_FILES) await fs.rm(path.join(dataDir, name), { force: true });
  for (const dir of BACKUP_DIRS) await fs.rm(path.join(dataDir, dir), { recursive: true, force: true });
  const root = path.resolve(dataDir);
  for (const { rel, data } of entries) {
    const target = path.resolve(root, ...rel.split("/"));
    if (!target.startsWith(root + path.sep)) throw new Error(mainT().backup.badPath(rel));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
  }
}
