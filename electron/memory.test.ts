import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { listMemoryFiles, resolveMemoryPath, runMemoryCommand } from "./memory";

let root = "";
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), "mem-")); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe("resolveMemoryPath", () => {
  it("accepts paths under /memories", () => {
    expect(resolveMemoryPath(root, "/memories")).toBe(path.resolve(root));
    expect(resolveMemoryPath(root, "/memories/a/b.md")).toBe(path.join(root, "a", "b.md"));
  });
  it("rejects traversal, encoded traversal and foreign roots", () => {
    expect(resolveMemoryPath(root, "/memories/../secret")).toBeNull();
    expect(resolveMemoryPath(root, "/memories/%2e%2e/secret")).toBeNull();
    expect(resolveMemoryPath(root, "/memoriesX/a")).toBeNull();
    expect(resolveMemoryPath(root, "/etc/passwd")).toBeNull();
    expect(resolveMemoryPath(root, "/memories/a\\..\\..\\x")).toBeNull();
    expect(resolveMemoryPath(root, 42)).toBeNull();
  });
});

describe("runMemoryCommand", () => {
  it("creates, views, edits, inserts, renames and deletes files", async () => {
    expect((await runMemoryCommand(root, { command: "view", path: "/memories" })).content).toContain("/memories");
    expect((await runMemoryCommand(root, { command: "create", path: "/memories/prefs.md", file_text: "color: blue\nsize: M" })).isError).toBe(false);
    const view = await runMemoryCommand(root, { command: "view", path: "/memories/prefs.md" });
    expect(view.content).toBe("Here's the content of /memories/prefs.md with line numbers:\n     1\tcolor: blue\n     2\tsize: M");
    expect((await runMemoryCommand(root, { command: "str_replace", path: "/memories/prefs.md", old_str: "blue", new_str: "green" })).content).toBe("The memory file has been edited.");
    expect((await runMemoryCommand(root, { command: "insert", path: "/memories/prefs.md", insert_line: 0, insert_text: "# prefs\n" })).isError).toBe(false);
    expect(await fs.readFile(path.join(root, "prefs.md"), "utf8")).toBe("# prefs\ncolor: green\nsize: M");
    expect((await runMemoryCommand(root, { command: "rename", old_path: "/memories/prefs.md", new_path: "/memories/user/prefs.md" })).isError).toBe(false);
    const files = await listMemoryFiles(root);
    expect(files.map(f => f.path)).toEqual(["/memories/user/prefs.md"]);
    expect((await runMemoryCommand(root, { command: "delete", path: "/memories/user" })).content).toBe("Successfully deleted /memories/user");
    expect(await listMemoryFiles(root)).toEqual([]);
  });
  it("reports errors with the documented messages", async () => {
    await runMemoryCommand(root, { command: "create", path: "/memories/a.md", file_text: "x\nx" });
    expect((await runMemoryCommand(root, { command: "view", path: "/memories/none.md" })).content)
      .toBe("The path /memories/none.md does not exist. Please provide a valid path.");
    const dup = await runMemoryCommand(root, { command: "str_replace", path: "/memories/a.md", old_str: "x", new_str: "y" });
    expect(dup.isError).toBe(true);
    expect(dup.content).toContain("Multiple occurrences");
    expect((await runMemoryCommand(root, { command: "insert", path: "/memories/a.md", insert_line: 9, insert_text: "z" })).content)
      .toContain("[0, 2]");
    expect((await runMemoryCommand(root, { command: "delete", path: "/memories" })).isError).toBe(true);
    expect((await runMemoryCommand(root, { command: "create", path: "/memories/../escape.md", file_text: "x" })).isError).toBe(true);
    await expect(fs.stat(path.join(root, "..", "escape.md"))).rejects.toThrow();
  });
});
