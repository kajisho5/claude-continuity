import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mainT } from "./i18n";
import { saveFile, withFileLock } from "./fileStore";

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

/** Image type from the file's first bytes; the API rejects an image whose declared type does not match its data. */
export function sniffImage(bytes: Uint8Array): string | null {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 16));
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && (b.subarray(0, 6).toString("latin1") === "GIF87a" || b.subarray(0, 6).toString("latin1") === "GIF89a")) return "image/gif";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export function classify(name: string, bytes: Buffer): { kind: AttachmentKind; mediaType: string } {
  const ext = path.extname(name).toLowerCase();
  // A JPEG saved as .png (common for web downloads) is still a JPEG; the contents decide.
  const image = sniffImage(bytes);
  if (image) return { kind: "image", mediaType: image };
  if (IMAGE_TYPES[ext]) return { kind: "file", mediaType: "application/octet-stream" };
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
  /** Files API ids belong to the API key's workspace; after a key change or a restore they are uploaded again. */
  async clearFileIds() {
    await withFileLock(this.indexFile() + ":update", async () => {
      const index = await this.index();
      if (!Object.keys(index).length) return;
      await saveFile(this.indexFile(), JSON.stringify(Object.fromEntries(Object.entries(index).map(([id, v]) => [id, { ...v, fileId: undefined }]))));
    });
  }
  async setFileId(id: string, fileId: string) {
    await withFileLock(this.indexFile() + ":update", async () => {
      const index = await this.index();
      index[id] = { ...index[id], fileId };
      await saveFile(this.indexFile(), JSON.stringify(index));
    });
  }
}
