// Test-only entry point. Linux CI has no OS keyring, so let safeStorage use plain-text encryption,
// report the real app version (this folder's package.json has none), then load the built app.
const path = require("node:path");
const { app, safeStorage } = require("electron");
const repo = path.resolve(__dirname, "..", "..");
app.setVersion(require(path.join(repo, "package.json")).version);
safeStorage.setUsePlainTextEncryption(true);
require(path.join(repo, "dist-electron", "main.js"));
