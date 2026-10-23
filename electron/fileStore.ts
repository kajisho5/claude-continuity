import fs from "node:fs/promises";

/**
 * Safe writes for the app's JSON files: each file is written to a temp file and renamed into place
 * (a crash mid-write leaves the previous version), and work on one file runs one at a time
 * (read-modify-write cycles such as the usage ledger cannot interleave and drop each other's rows).
 */
const queues = new Map<string, Promise<unknown>>();

// Not reentrant: inside fn, write with writeFileAtomic, not saveFile (which takes the same lock).
export function withFileLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const run = (queues.get(file) ?? Promise.resolve()).catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  queues.set(file, tail);
  void tail.then(() => { if (queues.get(file) === tail) queues.delete(file); });
  return run;
}

/** Resolves once every write queued so far has finished (used before quitting). */
export function drainFileWrites(): Promise<void> {
  return Promise.all([...queues.values()]).then(() => undefined);
}

let tmpCounter = 0;
export async function writeFileAtomic(file: string, data: string | Uint8Array): Promise<void> {
  const tmp = `${file}.${process.pid}.${++tmpCounter}.tmp`;
  try {
    const handle = await fs.open(tmp, "w");
    try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
    await renameWithRetry(tmp, file);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

/** On Windows a reader (antivirus, indexer) can hold the target briefly; retry the replace a few times. */
async function renameWithRetry(from: string, to: string) {
  for (let attempt = 0; ; attempt++) {
    try { return await fs.rename(from, to); }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 4 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) throw error;
      await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
    }
  }
}

export const saveFile = (file: string, data: string | Uint8Array) => withFileLock(file, () => writeFileAtomic(file, data));

/** Holds the locks of several files at once (each acquired in turn), e.g. while a restore replaces them. */
export function withFileLocks<T>(files: string[], fn: () => Promise<T>): Promise<T> {
  return files.length ? withFileLock(files[0], () => withFileLocks(files.slice(1), fn)) : fn();
}

/**
 * Reads a JSON file. A missing file gives `fallback`. A file that cannot be parsed is moved aside as
 * "<name>.corrupt-<time>" (kept for recovery, never overwritten) and gives `fallback`. Any other read
 * error (a locked or unreadable file) is thrown, so callers do not mistake it for "no data" and save over it.
 */
export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  let raw: string;
  try { raw = await fs.readFile(file, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
  try { return JSON.parse(raw) as T; }
  catch {
    // If it cannot be moved aside (a locked file on Windows), report the error rather than let it be overwritten.
    await fs.rename(file, `${file}.corrupt-${Date.now()}`);
    return fallback;
  }
}
