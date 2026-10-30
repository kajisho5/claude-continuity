import AdmZip from "adm-zip";
import { entryData } from "./zipSafe";

// Office files are zips of XML. Their text is read here so they can be sent like any text document,
// without code execution (the Claude apps read them the same way).
const MAX_ENTRY = 20 * 1024 * 1024;
const MAX_TEXT = 2 * 1024 * 1024;

const decode = (s: string) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, "&");

/** Paragraphs (`<p>` elements of the given namespace) and the text runs (`<t>`) inside each. */
function paragraphs(xml: string, ns: "w" | "a"): string[] {
  const out: string[] = [];
  for (const p of xml.match(new RegExp(`<${ns}:p[\\s>][\\s\\S]*?</${ns}:p>`, "g")) ?? []) {
    const runs = [...p.matchAll(new RegExp(`<${ns}:(t)(?:\\s[^>]*)?>([\\s\\S]*?)</${ns}:t>|<${ns}:(tab|br)\\b[^>]*/>`, "g"))]
      .map(m => m[1] ? decode(m[2]) : m[3] === "tab" ? "\t" : "\n");
    const line = runs.join("");
    if (line.trim()) out.push(line);
  }
  return out;
}

const numbered = (zip: AdmZip, re: RegExp) => zip.getEntries()
  .map(e => ({ e, m: re.exec(e.entryName) }))
  .filter((x): x is { e: AdmZip.IZipEntry; m: RegExpExecArray } => !!x.m)
  .sort((a, b) => Number(a.m[1]) - Number(b.m[1]));

const read = (zip: AdmZip, name: string) => {
  const entry = zip.getEntry(name);
  return entry ? entryData(entry, MAX_ENTRY).toString("utf8") : "";
};

function columnIndex(ref: string): number {
  let n = 0;
  for (const c of ref.replace(/\d+$/, "")) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function sheetsText(zip: AdmZip): string {
  const shared = (read(zip, "xl/sharedStrings.xml").match(/<si>[\s\S]*?<\/si>/g) ?? [])
    .map(si => [...si.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => decode(m[1])).join(""));
  const names = [...read(zip, "xl/workbook.xml").matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map(m => decode(m[1]));
  return numbered(zip, /^xl\/worksheets\/sheet(\d+)\.xml$/).map(({ e }, i) => {
    const xml = entryData(e, MAX_ENTRY).toString("utf8");
    const rows = (xml.match(/<row\b[\s\S]*?<\/row>/g) ?? []).map(row => {
      const cells: string[] = [];
      for (const c of row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], body = c[2] ?? "";
        const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
        const type = /\bt="(\w+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        const value = type === "s" && v !== undefined ? shared[Number(v)] ?? ""
          : type === "inlineStr" ? [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => decode(m[1])).join("")
          : v !== undefined ? decode(v) : "";
        cells[ref ? columnIndex(ref) : cells.length] = value;
      }
      return Array.from(cells, x => x ?? "").join("\t");
    }).filter(r => r.trim());
    return `# ${names[i] ?? `Sheet${i + 1}`}\n${rows.join("\n")}`;
  }).join("\n\n");
}

/** The text of a .docx, .pptx or .xlsx file, or null for other files or files that cannot be read. */
export function officeText(name: string, bytes: Buffer): string | null {
  const ext = name.toLowerCase().match(/\.(docx|pptx|xlsx)$/)?.[1];
  if (!ext) return null;
  try {
    const zip = new AdmZip(bytes);
    let text = "";
    if (ext === "docx") text = paragraphs(read(zip, "word/document.xml"), "w").join("\n");
    else if (ext === "pptx") {
      text = numbered(zip, /^ppt\/slides\/slide(\d+)\.xml$/)
        .map(({ e }, i) => `## Slide ${i + 1}\n${paragraphs(entryData(e, MAX_ENTRY).toString("utf8"), "a").join("\n")}`)
        .join("\n\n");
    } else text = sheetsText(zip);
    text = text.trim();
    return text ? text.slice(0, MAX_TEXT) : null;
  } catch {
    return null;
  }
}
