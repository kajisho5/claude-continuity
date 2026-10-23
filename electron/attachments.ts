import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mainT } from "./i18n";

export type AttachmentKind = "image" | "pdf" | "text" | "file";
export type Attachment = { id: string; name: string; mediaType: string; size: number; kind: AttachmentKind };

// Limits from https://platform.claude.com/docs/en/build-with-claude/vision and .../pdf-support (request-wide PDF cap is 32MB).
export const MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

const IMAGE_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl", ".xml", ".yaml", ".yml", ".toml", ".ini", ".log",
  ".html", ".htm", ".css", ".scss", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift",
  ".c", ".h", ".cpp", ".hpp", ".cs", ".php", ".sh", ".bash", ".zsh", ".ps1", ".sql", ".r", ".tex", ".vue", ".svelte", ".env.example"]);
const FILE_TYPES: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".zip": "application/zip"
};

export function classify(name: string, bytes: Buffer): { kind: AttachmentKind; mediaType: string } {
  const ext = path.extname(name).toLowerCase();
  if (IMAGE_TYPES[ext]) return { kind: "image", mediaType: IMAGE_TYPES[ext] };
  if (ext === ".pdf" || bytes.subarray(0, 5).toString("latin1") === "%PDF-") return { kind: "pdf", mediaType: "application/pdf" };
  if (TEXT_EXTENSIONS.has(ext) || (!FILE_TYPES[ext] && !bytes.subarray(0, 8192).includes(0))) return { kind: "text", mediaType: "text/plain" };
  return { kind: "file", mediaType: FILE_TYPES[ext] ?? "application/octet-stream" };
}

export class AttachmentStore {
  constructor(private readonly dir: string) {}
  private fileFor(id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error(mainT().attachments.badId);
    return path.join(this.dir, id);
  }
  private indexFile() { return path.join(this.dir, "index.json"); }
  private async index(): Promise<Record<string, { fileId?: string }>> {
    try { return JSON.parse(await fs.readFile(this.indexFile(), "utf8")); } catch { return {}; }
  }

  async add(name: string, bytes: Buffer): Promise<Attachment> {
    if (bytes.length === 0) throw new Error(mainT().attachments.empty(name));
    if (bytes.length > MAX_ATTACHMENT_BYTES) throw new Error(mainT().attachments.tooLarge(name));
    const { kind, mediaType } = classify(name, bytes);
    if (kind === "image" && bytes.length > MAX_IMAGE_BYTES) throw new Error(mainT().attachments.imageTooLarge(name));
    if (kind === "text" && bytes.length > MAX_TEXT_BYTES) throw new Error(mainT().attachments.textTooLarge(name));
    await fs.mkdir(this.dir, { recursive: true });
    const id = randomUUID();
    await fs.writeFile(this.fileFor(id), bytes);
    return { id, name: path.basename(name).slice(0, 200), mediaType, size: bytes.length, kind };
  }
  async addPath(filePath: string): Promise<Attachment> {
    const info = await fs.stat(filePath);
    if (!info.isFile()) throw new Error(mainT().attachments.notFile(path.basename(filePath)));
    if (info.size > MAX_ATTACHMENT_BYTES) throw new Error(mainT().attachments.tooLarge(path.basename(filePath)));
    return this.add(path.basename(filePath), await fs.readFile(filePath));
  }
  read(id: string): Promise<Buffer> { return fs.readFile(this.fileFor(id)); }
  async fileId(id: string): Promise<string | undefined> { return (await this.index())[id]?.fileId; }
  async setFileId(id: string, fileId: string) {
    const index = await this.index();
    index[id] = { ...index[id], fileId };
    await fs.writeFile(this.indexFile(), JSON.stringify(index), "utf8");
  }
}
