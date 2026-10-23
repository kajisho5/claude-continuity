import fs from "node:fs/promises";
import path from "node:path";
import { mainT } from "./i18n";

// Client-side handler for the memory_20250818 tool. Return strings follow
// https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool#tool-commands
const VIRTUAL_ROOT = "/memories";
const MAX_FILE_CHARS = 200_000;
const VIEW_LIMIT_CHARS = 16_000;

export type MemoryResult = { content: string; isError: boolean };
type Input = Record<string, unknown>;

function ok(content: string): MemoryResult { return { content, isError: false }; }
function fail(content: string): MemoryResult { return { content, isError: true }; }

/** Maps a /memories path onto the real root, rejecting anything that escapes it. */
export function resolveMemoryPath(root: string, virtualPath: unknown): string | null {
  if (typeof virtualPath !== "string") return null;
  // Names are used as written ("50%_off.md" is a valid name); the decoded form is only checked so that
  // URL-encoded traversal such as %2e%2e is still refused.
  let decoded = virtualPath;
  try { decoded = decodeURIComponent(virtualPath); } catch { /* a literal % */ }
  if (virtualPath !== VIRTUAL_ROOT && !virtualPath.startsWith(VIRTUAL_ROOT + "/")) return null;
  if ([virtualPath, decoded].some(p => p.split(/[\\/]/).some(part => part === ".." || part === "."))) return null;
  // Names that Windows cannot store (":" would even create a hidden stream) are refused everywhere, so memory
  // and its backups stay portable.
  if (virtualPath.slice(VIRTUAL_ROOT.length).split("/").some(part => /[<>:"|?*\x00-\x1f]/.test(part) || /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(part))) return null;
  const relative = virtualPath.slice(VIRTUAL_ROOT.length).replace(/^\/+/, "");
  const resolved = path.resolve(root, relative);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) return null;
  return resolved;
}

async function stat(p: string) { try { return await fs.lstat(p); } catch { return null; } }

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}M`;
  return `${Math.max(0.1, bytes / 1024).toFixed(1)}K`;
}

async function listing(dir: string, virtualDir: string): Promise<string[]> {
  const lines: string[] = [];
  async function walk(real: string, virtual: string, depth: number) {
    const entries = await fs.readdir(real, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.isSymbolicLink()) continue;
      const childReal = path.join(real, entry.name);
      const childVirtual = `${virtual}/${entry.name}`;
      const info = await fs.stat(childReal);
      lines.push(`${humanSize(info.size)}\t${childVirtual}`);
      if (entry.isDirectory() && depth < 2) await walk(childReal, childVirtual, depth + 1);
    }
  }
  const info = await fs.stat(dir);
  lines.push(`${humanSize(info.size)}\t${virtualDir}`);
  await walk(dir, virtualDir, 1);
  return lines;
}

function numbered(text: string, start = 1): string {
  return text.split("\n").map((line, i) => `${String(i + start).padStart(6, " ")}\t${line}`).join("\n");
}

export async function runMemoryCommand(root: string, input: Input): Promise<MemoryResult> {
  await fs.mkdir(root, { recursive: true });
  const command = String(input.command ?? "");
  const target = command === "rename" ? null : resolveMemoryPath(root, input.path);
  if (command !== "rename" && !target) return fail(`Error: The path ${String(input.path)} is outside ${VIRTUAL_ROOT}`);
  const virtual = String(input.path ?? "");

  switch (command) {
    case "view": {
      const info = await stat(target!);
      if (!info || info.isSymbolicLink()) return fail(`The path ${virtual} does not exist. Please provide a valid path.`);
      if (info.isDirectory()) {
        return ok(`Here're the files and directories up to 2 levels deep in ${virtual}, excluding hidden items and node_modules:\n${(await listing(target!, virtual.replace(/\/+$/, ""))).join("\n")}`);
      }
      const text = await fs.readFile(target!, "utf8");
      const lines = text.split("\n");
      if (lines.length > 999_999) return fail(`File ${virtual} exceeds maximum line limit of 999,999 lines.`);
      const range = Array.isArray(input.view_range) ? input.view_range.map(Number) : null;
      const start = range ? Math.max(1, range[0] || 1) : 1;
      const end = range && range[1] !== -1 ? Math.min(lines.length, range[1] || lines.length) : lines.length;
      let body = numbered(lines.slice(start - 1, end).join("\n"), start);
      if (body.length > VIEW_LIMIT_CHARS) body = body.slice(0, VIEW_LIMIT_CHARS) + mainT().memory.viewTruncated;
      return ok(`Here's the content of ${virtual} with line numbers:\n${body}`);
    }
    case "create": {
      const text = String(input.file_text ?? "");
      if (text.length > MAX_FILE_CHARS) return fail(`Error: File content exceeds ${MAX_FILE_CHARS} characters`);
      if (target === path.resolve(root)) return fail("Error: Cannot overwrite the memory directory");
      await fs.mkdir(path.dirname(target!), { recursive: true });
      await fs.writeFile(target!, text, "utf8");
      return ok(`File created successfully at: ${virtual}`);
    }
    case "str_replace": {
      const info = await stat(target!);
      if (!info || !info.isFile()) return fail(`Error: The path ${virtual} does not exist. Please provide a valid path.`);
      const text = await fs.readFile(target!, "utf8");
      const oldStr = String(input.old_str ?? "");
      const occurrences = oldStr ? text.split(oldStr).length - 1 : 0;
      if (occurrences === 0) return fail(`No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${virtual}.`);
      if (occurrences > 1) {
        const lineNumbers = text.split("\n").map((line, i) => line.includes(oldStr) ? i + 1 : 0).filter(Boolean);
        return fail(`No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines: ${lineNumbers.join(", ")}. Please ensure it is unique`);
      }
      const updated = text.replace(oldStr, () => String(input.new_str ?? ""));
      if (updated.length > MAX_FILE_CHARS) return fail(`Error: File content exceeds ${MAX_FILE_CHARS} characters`);
      await fs.writeFile(target!, updated, "utf8");
      return ok("The memory file has been edited.");
    }
    case "insert": {
      const info = await stat(target!);
      if (!info || !info.isFile()) return fail(`Error: The path ${virtual} does not exist`);
      const lines = (await fs.readFile(target!, "utf8")).split("\n");
      const at = Number(input.insert_line);
      if (!Number.isInteger(at) || at < 0 || at > lines.length) {
        return fail(`Error: Invalid \`insert_line\` parameter: ${String(input.insert_line)}. It should be within the range of lines of the file: [0, ${lines.length}]`);
      }
      lines.splice(at, 0, String(input.insert_text ?? "").replace(/\n$/, ""));
      await fs.writeFile(target!, lines.join("\n"), "utf8");
      return ok(`The file ${virtual} has been edited.`);
    }
    case "delete": {
      if (target === path.resolve(root)) return fail("Error: Cannot delete the /memories directory");
      const info = await stat(target!);
      if (!info) return fail(`Error: The path ${virtual} does not exist`);
      await fs.rm(target!, { recursive: true, force: true });
      return ok(`Successfully deleted ${virtual}`);
    }
    case "rename": {
      const from = resolveMemoryPath(root, input.old_path);
      const to = resolveMemoryPath(root, input.new_path);
      if (!from || !to) return fail("Error: Paths must stay inside /memories");
      if (from === path.resolve(root)) return fail("Error: Cannot rename the /memories directory");
      if (!(await stat(from))) return fail(`Error: The path ${String(input.old_path)} does not exist`);
      if (await stat(to)) return fail(`Error: The destination ${String(input.new_path)} already exists`);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.rename(from, to);
      return ok(`Successfully renamed ${String(input.old_path)} to ${String(input.new_path)}`);
    }
    default:
      return fail(`Error: unknown command ${command}`);
  }
}

/** Flat list of memory files for the settings screen. */
export async function listMemoryFiles(root: string): Promise<{ path: string; size: number; content: string }[]> {
  await fs.mkdir(root, { recursive: true });
  const out: { path: string; size: number; content: string }[] = [];
  async function walk(real: string, virtual: string) {
    for (const entry of await fs.readdir(real, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const childReal = path.join(real, entry.name);
      const childVirtual = `${virtual}/${entry.name}`;
      if (entry.isDirectory()) await walk(childReal, childVirtual);
      else {
        const content = await fs.readFile(childReal, "utf8").catch(() => "");
        out.push({ path: childVirtual, size: Buffer.byteLength(content), content: content.slice(0, 20_000) });
      }
    }
  }
  await walk(root, VIRTUAL_ROOT);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
