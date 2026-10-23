// Quick-entry global shortcut and the screenshot button.
const { launch, onboard, openSettings, until, text, assert } = require("../lib.cjs");

const registered = (app, accel) => app.evaluate(({ globalShortcut }, a) => globalShortcut.isRegistered(a), accel);

module.exports = async function quick(ctx) {
  const { app, w } = await launch(ctx);
  await onboard(w, { waitModels: false });
  assert.equal(await registered(app, "CommandOrControl+Alt+Space"), true, "the default shortcut is registered");

  await w.click(".composer .screenshot");
  await w.waitForSelector(".attachment-row", { timeout: 15000 });
  const chips = await w.locator(".attachment-row").allTextContents();
  assert.equal(chips.length, 1);
  assert.match(chips[0], /^screenshot-\d{8}-\d{6}\.png画像 · \d+KB/);

  await openSettings(w);
  await w.selectOption(".quick-shortcut select", "CommandOrControl+Shift+Space");
  await until(() => registered(app, "CommandOrControl+Shift+Space"), Boolean, { message: "new shortcut registered" });
  assert.equal(await registered(app, "CommandOrControl+Alt+Space"), false, "old shortcut released");
  await w.selectOption(".quick-shortcut select", "");
  await until(() => registered(app, "CommandOrControl+Shift+Space"), r => r === false, { message: "shortcut turned off" });
  await w.keyboard.press("Escape"); await w.waitForSelector(".settings", { state: "detached" });

  // The shortcut firing: settings close, a new chat opens with the composer focused.
  await openSettings(w);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send("app:quick"));
  await w.waitForSelector(".settings", { state: "detached" });
  await until(() => w.evaluate(() => document.activeElement?.tagName), t => t === "TEXTAREA", { message: "composer focused" });
};
