import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import { entryData } from "./zipSafe";

describe("entryData", () => {
  it("returns normal entries", () => {
    const zip = new AdmZip();
    zip.addFile("a.txt", Buffer.from("hello ".repeat(1000)));
    const entry = new AdmZip(zip.toBuffer()).getEntries()[0];
    expect(entryData(entry, 1_000_000).toString()).toBe("hello ".repeat(1000));
  });
  it("stops inflating at the limit even when the entry claims to be empty", () => {
    const zip = new AdmZip();
    zip.addFile("bomb.txt", Buffer.alloc(5_000_000));
    const entry = new AdmZip(zip.toBuffer()).getEntries()[0];
    entry.header.size = 0;
    expect(() => entryData(entry, 100_000)).toThrow();
  });
});
