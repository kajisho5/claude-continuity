// After the dmg files are notarized and stapled their bytes change; update their sha512/size in latest-mac.yml.
// (The Mac updater downloads the zip, but the feed should still describe the files that are published.)
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const dir = process.argv[2] || "release";
const feed = path.join(dir, "latest-mac.yml");
const lines = fs.readFileSync(feed, "utf8").split("\n");
let current = null;
for (let i = 0; i < lines.length; i++) {
  const url = /^\s*- url: (.+\.dmg)\s*$/.exec(lines[i]);
  if (url) {
    const file = path.join(dir, url[1].trim());
    const data = fs.readFileSync(file);
    current = { sha512: crypto.createHash("sha512").update(data).digest("base64"), size: data.length };
    continue;
  }
  if (/^\s*- url: /.test(lines[i]) || /^\S/.test(lines[i])) current = null;
  if (!current) continue;
  lines[i] = lines[i].replace(/^(\s*sha512: ).*$/, `$1${current.sha512}`).replace(/^(\s*size: ).*$/, `$1${current.size}`);
  // The old blockmap no longer matches the stapled dmg; drop the field (the updater uses the zip).
  if (/^\s*blockMapSize: /.test(lines[i])) lines[i] = null;
}
fs.writeFileSync(feed, lines.filter(l => l !== null).join("\n"));
console.log("updated", feed);
