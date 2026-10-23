import path from "node:path";
import fs from "node:fs/promises";
import AdmZip from "adm-zip";
import { mainT } from "./i18n";

/**
 * Custom Skills uploaded through the Skills API (https://platform.claude.com/docs/en/build-with-claude/skills-guide):
 * a folder with SKILL.md at its root, under 30 MB uncompressed; up to 20 Skills per request.
 */
export const SKILL_UPLOAD_LIMIT = 30 * 1024 * 1024;
export const SKILLS_PER_REQUEST = 20;
const MAX_FILES = 500;

export type SkillFile = { name: string; data: Buffer };

/**
 * Collects a skill's files as "<folder>/<relative path>" (the API wants them under one top-level folder).
 * Accepts the skill folder itself, a SKILL.md inside it, or a .zip / .skill archive of it.
 */
export async function readSkillSource(source: string): Promise<SkillFile[]> {
  const t = mainT().skills;
  const stat = await fs.stat(source);
  let files: SkillFile[];
  if (stat.isDirectory()) files = await readFolder(source, path.basename(source));
  else if (path.basename(source).toLowerCase() === "skill.md") files = await readFolder(path.dirname(source), path.basename(path.dirname(source)));
  else if (/\.(zip|skill)$/i.test(source)) files = readArchive(await fs.readFile(source), path.basename(source).replace(/\.(zip|skill)$/i, ""));
  else throw new Error(t.unsupported);
  if (!files.some(f => f.name.split("/").length === 2 && f.name.split("/")[1].toLowerCase() === "skill.md")) throw new Error(t.noSkillMd);
  if (files.reduce((sum, f) => sum + f.data.length, 0) > SKILL_UPLOAD_LIMIT) throw new Error(t.tooLarge);
  return files;
}

async function readFolder(root: string, top: string): Promise<SkillFile[]> {
  const out: SkillFile[] = [];
  let total = 0;
  const walk = async (dir: string) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      // Hidden files (.git, .DS_Store) and symlinks stay out of the upload.
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { await walk(full); continue; }
      if (!entry.isFile()) continue;
      if (out.length >= MAX_FILES) throw new Error(mainT().skills.tooManyFiles);
      const data = await fs.readFile(full);
      total += data.length;
      if (total > SKILL_UPLOAD_LIMIT) throw new Error(mainT().skills.tooLarge);
      out.push({ name: `${top}/${path.relative(root, full).split(path.sep).join("/")}`, data });
    }
  };
  await walk(root);
  return out;
}

/** An archive may hold the files at its root or inside one folder; either way they end up under one folder. */
export function readArchive(buffer: Buffer, fallbackTop: string): SkillFile[] {
  const all = new AdmZip(buffer).getEntries();
  for (const e of all) if (e.entryName.split(/[\\/]/).includes("..") || path.isAbsolute(e.entryName)) throw new Error(mainT().skills.badArchive);
  const entries = all.filter(e => !e.isDirectory && !e.entryName.split("/").some(part => part.startsWith(".") || part === "__MACOSX"));
  if (entries.length > MAX_FILES) throw new Error(mainT().skills.tooManyFiles);
  const tops = new Set(entries.map(e => e.entryName.split("/")[0]));
  const nested = tops.size === 1 && entries.every(e => e.entryName.includes("/"));
  let total = 0;
  return entries.map(e => {
    total += e.header.size;
    if (total > SKILL_UPLOAD_LIMIT) throw new Error(mainT().skills.tooLarge);
    return { name: nested ? e.entryName : `${fallbackTop}/${e.entryName}`, data: e.getData() };
  });
}

/** container.skills for a request: Anthropic's document Skills plus the enabled custom ones, within the per-request limit. */
export function containerSkills(anthropic: string[], custom: string[]): { type: "anthropic" | "custom"; skill_id: string; version: "latest" }[] {
  return [
    ...anthropic.map(skill_id => ({ type: "anthropic" as const, skill_id, version: "latest" as const })),
    ...custom.map(skill_id => ({ type: "custom" as const, skill_id, version: "latest" as const }))
  ].slice(0, SKILLS_PER_REQUEST);
}
