import { afterEach, beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import AdmZip from "adm-zip";
import { allowedEntry, createBackup, readBackup, restoreEntries } from "./backup";

let dir: string;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-backup-")); });
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

async function seed(root: string) {
  await fs.mkdir(path.join(root, "attachments"), { recursive: true });
  await fs.mkdir(path.join(root, "memories", "notes"), { recursive: true });
  await fs.writeFile(path.join(root, "chats.json"), JSON.stringify([{ id: "a", title: "t", messages: [] }]));
  await fs.writeFile(path.join(root, "prefs.json"), JSON.stringify({ theme: "light" }));
  await fs.writeFile(path.join(root, "api-key.bin"), "secret");
  await fs.writeFile(path.join(root, "attachments", "x.png"), Buffer.from([1, 2, 3]));
  await fs.writeFile(path.join(root, "memories", "notes", "m.md"), "memo");
  await fs.writeFile(path.join(root, "unrelated.txt"), "skip");
}

describe("allowedEntry", () => {
  it("accepts known files and folders only", () => {
    expect(allowedEntry("chats.json")).toBe("chats.json");
    expect(allowedEntry("memories/notes/m.md")).toBe("memories/notes/m.md");
    expect(allowedEntry("attachments\\x.png")).toBe("attachments/x.png");
    expect(allowedEntry("api-key.bin")).toBeNull();
    expect(allowedEntry("other/x")).toBeNull();
  });
  it("rejects traversal and absolute paths", () => {
    expect(allowedEntry("memories/../api-key.bin")).toBeNull();
    expect(allowedEntry("/etc/passwd")).toBeNull();
    expect(allowedEntry("C:/x/chats.json")).toBeNull();
    expect(allowedEntry("attachments//x")).toBeNull();
  });
});

describe("backup round trip", () => {
  it("excludes the API key and unrelated files, and restores the rest", async () => {
    await seed(dir);
    const { zip, count } = await createBackup(dir, "0.1.0");
    const names = zip.getEntries().map(e => e.entryName).sort();
    expect(names).toEqual(["attachments/x.png", "chats.json", "manifest.json", "memories/notes/m.md", "prefs.json"]);
    expect(count).toBe(4);

    const target = path.join(dir, "target");
    await fs.mkdir(path.join(target, "memories"), { recursive: true });
    await fs.writeFile(path.join(target, "api-key.bin"), "keep-me");
    await fs.writeFile(path.join(target, "memories", "stale.md"), "old");
    await fs.writeFile(path.join(target, "usage.json"), "[]");
    await restoreEntries(target, readBackup(new AdmZip(zip.toBuffer())));
    expect(await fs.readFile(path.join(target, "api-key.bin"), "utf8")).toBe("keep-me");
    expect(await fs.readFile(path.join(target, "memories", "notes", "m.md"), "utf8")).toBe("memo");
    await expect(fs.access(path.join(target, "memories", "stale.md"))).rejects.toThrow();
    await expect(fs.access(path.join(target, "usage.json"))).rejects.toThrow();
    expect([...await fs.readFile(path.join(target, "attachments", "x.png"))]).toEqual([1, 2, 3]);
  });
});

describe("readBackup", () => {
  const manifest = Buffer.from(JSON.stringify({ app: "claude-continuity", format: 1 }));
  it("rejects archives without our manifest", () => {
    const zip = new AdmZip(); zip.addFile("chats.json", Buffer.from("[]"));
    expect(() => readBackup(zip)).toThrow("バックアップファイルではありません");
  });
  it("rejects unexpected entries and broken JSON", () => {
    const foreign = new AdmZip(); foreign.addFile("manifest.json", manifest); foreign.addFile("api-key.bin", Buffer.from("x"));
    expect(() => readBackup(foreign)).toThrow("想定外のファイル");
    const broken = new AdmZip(); broken.addFile("manifest.json", manifest); broken.addFile("chats.json", Buffer.from("{"));
    expect(() => readBackup(broken)).toThrow("壊れています");
  });
});
