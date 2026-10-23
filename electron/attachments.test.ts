import { describe, expect, it, vi } from "vitest";
vi.mock("./i18n", () => ({ mainT: () => ({ attachments: {} }) }));
const { classify, sniffImage } = await import("./attachments");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const GIF = Buffer.from("GIF89a\x01\x00", "latin1");
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);

describe("sniffImage", () => {
  it("reads the type from the first bytes", () => {
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(GIF)).toBe("image/gif");
    expect(sniffImage(WEBP)).toBe("image/webp");
    expect(sniffImage(Buffer.from("hello"))).toBeNull();
  });
});

describe("classify", () => {
  it("uses the contents, not the extension, for images", () => {
    expect(classify("photo.png", JPEG)).toEqual({ kind: "image", mediaType: "image/jpeg" });
    expect(classify("shot.webp", PNG)).toEqual({ kind: "image", mediaType: "image/png" });
  });
  it("does not send a file with an image name but other contents as an image", () => {
    expect(classify("fake.png", Buffer.from([1, 2, 0, 3])).kind).toBe("file");
  });
  it("keeps PDFs and text", () => {
    expect(classify("a.pdf", Buffer.from("%PDF-1.7")).kind).toBe("pdf");
    expect(classify("notes.md", Buffer.from("# hi")).kind).toBe("text");
  });
});
