import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import { officeText } from "./officeText";

function zipOf(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, text] of Object.entries(files)) zip.addFile(name, Buffer.from(text, "utf8"));
  return zip.toBuffer();
}

describe("officeText", () => {
  it("reads the paragraphs of a Word document", () => {
    const doc = zipOf({ "word/document.xml": `<w:document><w:body><w:p><w:r><w:t>見出し</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">A &amp; B</w:t></w:r><w:r><w:tab/><w:t>C</w:t></w:r></w:p></w:body></w:document>` });
    expect(officeText("memo.docx", doc)).toBe("見出し\nA & B\tC");
  });

  it("reads PowerPoint slides in slide order", () => {
    const deck = zipOf({
      "ppt/slides/slide10.xml": `<p:sld><a:p><a:r><a:t>十枚目</a:t></a:r></a:p></p:sld>`,
      "ppt/slides/slide2.xml": `<p:sld><a:p><a:r><a:t>二枚目</a:t></a:r></a:p></p:sld>`,
      "ppt/slides/slide1.xml": `<p:sld><a:p><a:r><a:t>表紙</a:t></a:r></a:p><a:p><a:r><a:t>副題</a:t></a:r></a:p></p:sld>`
    });
    expect(officeText("talk.pptx", deck)).toBe("## Slide 1\n表紙\n副題\n\n## Slide 2\n二枚目\n\n## Slide 3\n十枚目");
  });

  it("reads Excel sheets as tab-separated rows", () => {
    const book = zipOf({
      "xl/workbook.xml": `<workbook><sheets><sheet name="売上" sheetId="1"/></sheets></workbook>`,
      "xl/sharedStrings.xml": `<sst><si><t>月</t></si><si><t>金額</t></si><si><t>4月</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>120</v></c></row></sheetData></worksheet>`
    });
    expect(officeText("sales.xlsx", book)).toBe("# 売上\n月\t金額\n4月\t\t120");
  });

  it("returns null for other files and broken archives", () => {
    expect(officeText("data.zip", zipOf({ "a.txt": "x" }))).toBeNull();
    expect(officeText("broken.pptx", Buffer.from("not a zip"))).toBeNull();
    expect(officeText("empty.docx", zipOf({ "word/document.xml": "<w:document/>" }))).toBeNull();
  });
});
