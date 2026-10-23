import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readJsonFile, saveFile, withFileLock, writeFileAtomic } from "./fileStore";

let dir = "";
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), "filestore-")); });
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

describe("saveFile", () => {
  it("replaces the file and leaves no temp files", async () => {
    const file = path.join(dir, "a.json");
    await saveFile(file, "1");
    await saveFile(file, "2");
    expect(await fs.readFile(file, "utf8")).toBe("2");
    expect(await fs.readdir(dir)).toEqual(["a.json"]);
  });
});

describe("withFileLock", () => {
  it("runs read-modify-write cycles one at a time, so none is lost", async () => {
    const file = path.join(dir, "rows.json");
    const append = (n: number) => withFileLock(file, async () => {
      const rows = await readJsonFile<number[]>(file, []);
      await new Promise(r => setTimeout(r, 5));
      await writeFileAtomic(file, JSON.stringify([...rows, n]));
    });
    await Promise.all(Array.from({ length: 10 }, (_, i) => append(i)));
    expect((await readJsonFile<number[]>(file, [])).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("keeps going after a failed task", async () => {
    const file = path.join(dir, "x");
    await expect(withFileLock(file, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await withFileLock(file, async () => 42)).toBe(42);
  });
});

describe("readJsonFile", () => {
  it("returns the fallback for a missing file", async () => {
    expect(await readJsonFile(path.join(dir, "none.json"), [])).toEqual([]);
  });
  it("moves an unparsable file aside instead of letting it be overwritten", async () => {
    const file = path.join(dir, "chats.json");
    await fs.writeFile(file, '[{"id":');
    expect(await readJsonFile(file, [])).toEqual([]);
    const names = await fs.readdir(dir);
    expect(names.some(n => n.startsWith("chats.json.corrupt-"))).toBe(true);
    expect(names).not.toContain("chats.json");
  });
  it("throws other read errors", async () => {
    await expect(readJsonFile(dir, [])).rejects.toBeTruthy();
  });
});
