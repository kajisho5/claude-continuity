// Desktop notification when a reply finishes in the background, the update banner and the About tab.
const { launch, onboard, waitReply, openSettings, until, text, assert, REPO } = require("../lib.cjs");

module.exports = async function notificationsUpdates(ctx) {
  const { app, w } = await launch(ctx);
  await onboard(w);
  await w.evaluate(() => {
    window.__notes = [];
    window.Notification = class { constructor(title, opts) { window.__notes.push({ title, body: opts?.body }); this.onclick = null; } };
    document.hasFocus = () => false;
  });
  await w.click(".new-chat"); await w.fill(".composer textarea", "四半期の論点を表で"); await w.keyboard.press("Enter");
  await waitReply(w);
  const notes = await until(() => w.evaluate(() => window.__notes), n => n.length > 0, { message: "a notification is shown" });
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, "四半期の論点を表で");
  assert.ok(notes[0].body.startsWith("第3四半期の論点"), notes[0].body);

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send("update:status", { state: "available", version: "0.2.0" }));
  await w.waitForSelector(".update-banner");
  assert.equal(await text(w.locator(".update-banner span")), "アップデートがあります新しいバージョン 0.2.0 があります。");
  await w.click(".update-banner button:has-text('あとで')");
  assert.equal(await w.locator(".update-banner").count(), 0);

  await openSettings(w, "このアプリについて");
  const version = require(`${REPO}/package.json`).version;
  await until(() => text(w.locator(".update-row")), t => t.includes(`バージョン ${version}`), { message: "About shows the app version" });
  assert.ok((await text(w.locator(".update-row"))).includes("更新を確認"));
};
