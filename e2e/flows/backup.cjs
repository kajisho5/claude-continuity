// Back up to a ZIP, change state, then restore (with a safety backup) and keep the API key.
const fs = require("node:fs");
const path = require("node:path");
const { launch, onboard, ask, openSettings, until, text, assert } = require("../lib.cjs");

module.exports = async function backup(ctx) {
  const zip = path.join(ctx.tmp, "backup-test.zip");
  const { app, w } = await launch(ctx);
  await onboard(w);
  await w.click(".new-chat"); await ask(w, "バックアップ前の会話");
  await w.waitForTimeout(500); // the title is generated after the reply
  const titleBefore = await text(w.locator(".title-trigger span"));
  assert.equal(titleBefore, "四半期の論点");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, zip);

  await openSettings(w, "データとバックアップ");
  await w.click("text=バックアップを作成"); await w.waitForSelector(".toast");
  assert.equal(await text(w.locator(".toast").last()), "3 個のファイルをバックアップしました");
  assert.ok(fs.existsSync(zip) && fs.statSync(zip).size > 500, "the ZIP is written");
  await w.keyboard.press("Escape"); await w.waitForSelector(".settings", { state: "detached" });

  await w.click(".title-trigger"); await w.click(".chat-pop .menu-item:has-text('削除')"); await w.click(".dialog .btn-danger");
  await until(() => w.locator(".chatrow").count(), n => n === 1, { message: "chat deleted" });

  await openSettings(w, "データとバックアップ");
  await w.click("text=ZIP を選んで復元…"); await w.waitForSelector(".dialog");
  await w.keyboard.press("Escape");
  await w.waitForSelector(".dialog", { state: "detached" });
  assert.equal(await w.locator(".settings").count(), 1, "Escape closes only the confirm dialog");
  await w.click("text=ZIP を選んで復元…"); await w.click(".dialog .btn-danger");
  await w.waitForEvent("load", { timeout: 15000 }).catch(() => {});
  await until(() => w.locator(".chatrow").allTextContents().catch(() => []), l => l.length === 2, { timeout: 15000, message: "chats restored" });
  assert.deepEqual(await w.locator(".chatrow").allTextContents(), [titleBefore, "はじめに"]);
  assert.equal(await w.locator(".wizard").count(), 0, "the API key is kept");
  assert.equal(await w.locator("text=APIキーを設定").count(), 0);
  assert.equal(fs.readdirSync(path.join(ctx.userDataDir, "backups")).length, 1, "a safety backup is made before restoring");
};
