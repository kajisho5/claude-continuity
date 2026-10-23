#!/usr/bin/env node
// Runs the Electron e2e flows against the built app (`npm run build` first) with mock servers.
//   node e2e/run.cjs              run every flow
//   node e2e/run.cjs ui rag       run a subset (names as listed below)
// On Linux without a display, run under `xvfb-run -a`.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { closeApp, REPO } = require("./lib.cjs");

// Order matters only for readability of the output; each flow gets fresh state.
const FLOWS = [
  "ui", "projects", "math-and-stops", "profile-incognito", "past-chats", "notifications-updates",
  "styles-bulk-delete", "artifacts", "remote-mcp", "export-html", "handoff", "backup",
  "react", "local-mcp", "research", "skills", "rag", "quick", "english"
];
const FLOW_TIMEOUT = 240000;

function pick(args) {
  if (!args.length) return FLOWS;
  const unknown = args.filter(a => !FLOWS.includes(a));
  if (unknown.length) { console.error(`Unknown flow(s): ${unknown.join(", ")}\nAvailable: ${FLOWS.join(", ")}`); process.exit(2); }
  return FLOWS.filter(f => args.includes(f));
}

function checkBuild() {
  const missing = ["dist-electron/main.js", "dist/index.html"].filter(p => !fs.existsSync(path.join(REPO, p)));
  if (missing.length) { console.error(`Missing ${missing.join(", ")}: run \`npm run build\` first.`); process.exit(2); }
}

async function runFlow(name) {
  const flow = require(`./flows/${name}.cjs`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `cc-e2e-${name}-`));
  const ctx = { name, tmp, userDataDir: path.join(tmp, "user-data"), apps: [], mock: null, https: null };
  fs.mkdirSync(ctx.userDataDir);
  const servers = [];
  let timer;
  try {
    ctx.mock = await require(`./mocks/${flow.mock || "api"}.cjs`).start(8787);
    servers.push(ctx.mock);
    if (flow.https) { ctx.https = await require("./mocks/mcp-https.cjs").start({ port: 8443, dir: tmp }); servers.push(ctx.https); }
    await Promise.race([flow(ctx), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${FLOW_TIMEOUT / 1000}s`)), FLOW_TIMEOUT); })]);
    return { ok: true, tmp };
  } catch (error) {
    // Keep a screenshot of the last window for debugging.
    for (const app of ctx.apps) {
      const w = app.windows()[0];
      if (w) await w.screenshot({ path: path.join(tmp, "failure.png"), timeout: 5000 }).catch(() => {});
    }
    return { ok: false, tmp, error };
  } finally {
    clearTimeout(timer);
    for (const app of ctx.apps) await closeApp(app);
    for (const s of servers) await s.close().catch(() => {});
  }
}

(async () => {
  checkBuild();
  const names = pick(process.argv.slice(2));
  const results = [];
  const t0 = Date.now();
  for (const name of names) {
    const start = Date.now();
    const r = await runFlow(name);
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    results.push({ name, ...r });
    if (r.ok) {
      console.log(`PASS  ${name}  (${secs}s)`);
      fs.rmSync(r.tmp, { recursive: true, force: true });
    } else {
      console.log(`FAIL  ${name}  (${secs}s)\n      ${String(r.error && (r.error.stack || r.error)).split("\n").join("\n      ")}\n      state kept in ${r.tmp}`);
    }
  }
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} flows passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (failed.length) console.log(`Failed: ${failed.map(r => r.name).join(", ")}`);
  process.exit(failed.length ? 1 : 0);
})();
