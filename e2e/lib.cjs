// Shared helpers for the Electron e2e flows.
const path = require("node:path");
const assert = require("node:assert/strict");
const { _electron } = require("playwright");
const electronPath = require("electron");

const REPO = path.resolve(__dirname, "..");
const HARNESS = path.join(__dirname, "harness");
const API_URL = "http://127.0.0.1:8787";
const API_KEY = "sk-ant-test-key";

/**
 * Launches the built app through the test harness with this flow's fresh user-data dir.
 * Apps are tracked on ctx so the runner can close them if the flow throws.
 */
async function launch(ctx, { lang = "ja", env = {} } = {}) {
  const app = await _electron.launch({
    executablePath: electronPath,
    args: [HARNESS, "--no-sandbox", `--lang=${lang}`, `--user-data-dir=${ctx.userDataDir}`],
    env: { ...process.env, ANTHROPIC_BASE_URL: API_URL, ELECTRON_IS_DEV: "0", NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost", ...env },
    timeout: 60000
  });
  ctx.apps.push(app);
  const w = await app.firstWindow();
  await w.setViewportSize({ width: 1440, height: 920 }).catch(() => {});
  return { app, w };
}

/** Closes the app, killing it if it does not exit in time. */
async function closeApp(app) {
  const proc = app.process();
  await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 10000))]);
  if (proc && proc.exitCode === null && proc.signalCode === null) proc.kill("SIGKILL");
}

/** Walks the first-run wizard (Max 20x plan, API key) and waits for the model list. */
async function onboard(w, { waitModels = true } = {}) {
  await w.waitForSelector(".wizard");
  await w.click(".plan-option:has-text('Max 20x')");
  await w.click(".wizard-actions .btn-primary");
  await w.click(".wizard-actions .btn-primary");
  await w.fill(".wizard input[type=password]", API_KEY);
  await w.click(".wizard-actions .btn-primary");
  await w.waitForSelector(".wizard", { state: "detached" });
  if (waitModels) await w.waitForFunction(() => /Opus|Sonnet|Haiku/.test(document.querySelector(".model-trigger")?.textContent || ""));
}

/** Waits for the in-flight reply to finish. Fast replies can finish before `.message.pending` is seen. */
async function waitReply(w, timeout = 30000) {
  await w.waitForSelector(".message.pending", { timeout: 3000 }).catch(() => {});
  await w.waitForSelector(".message.pending", { state: "detached", timeout });
  await w.waitForTimeout(400);
}

/** Sends `text` from the composer and waits for the reply. */
async function ask(w, text, timeout) {
  await w.fill(".composer textarea", text);
  await w.keyboard.press("Enter");
  await waitReply(w, timeout);
}

/** Opens settings from the account menu, optionally on the tab whose label contains `tab`. */
async function openSettings(w, tab) {
  await w.click(".account > button");
  await w.click(".account .menu-item >> nth=0");
  await w.waitForSelector(".settings");
  if (tab) await w.click(`.settings-nav button:has-text('${tab}')`);
}

/** Polls `fn` until `check(value)` holds (or throws on timeout with the last value). */
async function until(fn, check, { timeout = 10000, interval = 100, message } = {}) {
  const t0 = Date.now(); let last;
  for (;;) {
    last = await fn();
    if (check(last)) return last;
    if (Date.now() - t0 > timeout) assert.fail(`${message || "condition not met"}; last value: ${JSON.stringify(last)}`);
    await new Promise(r => setTimeout(r, interval));
  }
}

const text = loc => loc.textContent().then(t => (t || "").trim());

module.exports = { REPO, API_KEY, launch, closeApp, onboard, ask, waitReply, openSettings, until, text, assert };
