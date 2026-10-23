import zlib from "node:zlib";
import type AdmZip from "adm-zip";

/**
 * An entry's contents, never more than `max` bytes. The size an archive declares is not trusted: adm-zip only
 * limits inflation to a declared size above zero, so an entry that claims 0 bytes could inflate without bound.
 */
export function entryData(entry: AdmZip.IZipEntry, max: number): Buffer {
  const method = entry.header.method;
  if (method === 0) {
    const data = entry.getCompressedData();
    if (data.length > max) throw new Error("zip entry too large");
    return data;
  }
  if (method !== 8) throw new Error("unsupported zip compression");
  return zlib.inflateRawSync(entry.getCompressedData(), { maxOutputLength: max });
}
