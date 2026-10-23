import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { containerSkills, readArchive, readSkillSource } from "./skills";

const SKILL_MD = "---\nname: weekly-report\ndescription: Writes the weekly report\n---\n# Weekly report\n";

describe("readSkillSource", () => {
  it("reads a folder under its own name, skipping hidden files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "skill-"));
    const dir = path.join(root, "weekly-report");
    await fs.mkdir(path.join(dir, "scripts"), { recursive: true });
    await fs.writeFile(path.join(dir, "SKILL.md"), SKILL_MD);
    await fs.writeFile(path.join(dir, "scripts", "build.py"), "print(1)");
    await fs.writeFile(path.join(dir, ".DS_Store"), "x");
    const names = (await readSkillSource(dir)).map(f => f.name).sort();
    expect(names).toEqual(["weekly-report/SKILL.md", "weekly-report/scripts/build.py"]);
    expect((await readSkillSource(path.join(dir, "SKILL.md"))).length).toBe(2);
  });
  it("requires SKILL.md at the top of the folder", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-"));
    await fs.mkdir(path.join(dir, "sub"));
    await fs.writeFile(path.join(dir, "sub", "SKILL.md"), SKILL_MD);
    await expect(readSkillSource(dir)).rejects.toThrow(/SKILL\.md/);
  });
});

describe("readArchive", () => {
  const zip = (entries: Record<string, string>) => { const z = new AdmZip(); for (const [k, v] of Object.entries(entries)) z.addFile(k, Buffer.from(v)); return z.toBuffer(); };
  it("keeps one enclosing folder, or adds one for files at the root", () => {
    expect(readArchive(zip({ "weekly-report/SKILL.md": SKILL_MD, "weekly-report/a.txt": "a", "__MACOSX/x": "" }), "x").map(f => f.name).sort()).toEqual(["weekly-report/SKILL.md", "weekly-report/a.txt"]);
    expect(readArchive(zip({ "SKILL.md": SKILL_MD }), "from-file").map(f => f.name)).toEqual(["from-file/SKILL.md"]);
  });
  it("rejects paths that leave the folder", () => {
    const z = new AdmZip(); z.addFile("a/SKILL.md", Buffer.from(SKILL_MD));
    const raw = z.toBuffer();
    // Patch the stored name to a traversal path of the same length.
    const evil = Buffer.from(raw.toString("latin1").split("a/SKILL.md").join("../KILL.md"), "latin1");
    expect(() => readArchive(evil, "x")).toThrow();
  });
});

describe("containerSkills", () => {
  it("lists Anthropic then custom skills, within the per-request limit", () => {
    const list = containerSkills(["xlsx", "docx"], ["skill_a", "skill_b"]);
    expect(list).toEqual([
      { type: "anthropic", skill_id: "xlsx", version: "latest" }, { type: "anthropic", skill_id: "docx", version: "latest" },
      { type: "custom", skill_id: "skill_a", version: "latest" }, { type: "custom", skill_id: "skill_b", version: "latest" }
    ]);
    expect(containerSkills(["xlsx", "docx", "pptx", "pdf"], Array.from({ length: 30 }, (_, i) => `s${i}`))).toHaveLength(20);
  });
});
