// Core chat UI: composer, streaming with thinking, tools/model menus, star/rename, sidebar,
// settings (greeting, light theme), delete with confirm, chats page.
const { launch, onboard, waitReply, until, text, assert } = require("../lib.cjs");

module.exports = async function ui(ctx) {
  const { w } = await launch(ctx);
  await onboard(w);
  await w.click(".new-chat"); await w.waitForSelector(".welcome");
  assert.equal(await w.locator(".send-btn").isDisabled(), true, "send is disabled when the composer is empty");

  const ta = w.locator(".composer textarea");
  // The welcome-screen composer grows with its text too.
  const welcomeStart = await ta.evaluate(e => e.offsetHeight);
  await ta.fill(Array.from({ length: 10 }, (_, i) => `${i + 1}行目`).join("\n"));
  await until(() => ta.evaluate(e => e.offsetHeight), h => h > welcomeStart + 60, { message: "welcome textarea grows with content" });
  await ta.fill("ゆっくり 四半期の論点を表で");
  await w.keyboard.press("Enter");
  await w.waitForSelector(".message.pending", { timeout: 5000 }); // the slow variant streams for a few seconds
  await waitReply(w);
  assert.equal(await text(w.locator(".thinking summary").first()), "思考プロセス");
  assert.ok((await text(w.locator(".message.assistant .markdown").last())).includes("第3四半期の論点"));
  assert.equal(await w.locator(".message.assistant .markdown table").count(), 1, "the reply renders a table");

  // The footer composer grows with its text, up to a cap.
  await ta.fill("一行");
  const oneLine = await ta.evaluate(e => e.offsetHeight);
  await ta.fill(Array.from({ length: 6 }, (_, i) => `${i + 1}行目`).join("\n"));
  await until(() => ta.evaluate(e => e.offsetHeight), h => h > oneLine * 3, { message: "textarea grows with content" });
  await ta.fill(Array.from({ length: 40 }, (_, i) => `${i + 1}行目`).join("\n"));
  await until(() => ta.evaluate(e => e.offsetHeight), h => h === 300, { message: "textarea growth is capped at 300px" });
  await ta.fill("");

  await w.click(".tools .round-btn"); await w.click(".tools-style"); await w.keyboard.press("Escape");
  await w.click(".model-trigger");
  await w.click(".effort-row button >> nth=-1");
  assert.equal(await text(w.locator(".model-trigger")), "Opus 5.5思考: 最大");
  await w.keyboard.press("Escape");
  assert.equal(await w.locator(".menu").count(), 0, "menus close on Escape");

  // Star and rename through the row menu and the title menu.
  await w.hover(".chatrow.active"); await w.click(".chatrow.active .row-more");
  await w.click(".chat-pop .menu-item:has-text('スターを付ける')");
  assert.equal(await w.locator(".label:has-text('スター付き')").count(), 1, "starred section appears");
  assert.equal(await w.locator(".title-trigger .star-on").count(), 1, "header shows the star");
  await w.click(".title-trigger"); await w.click(".chat-pop .menu-item:has-text('名前を変更')");
  await w.fill(".dialog input", "四半期レビュー"); await w.keyboard.press("Enter");
  assert.equal(await text(w.locator(".title-trigger span")), "四半期レビュー");
  assert.equal(await text(w.locator(".chatrow.active .chatlink")), "四半期レビュー");

  await w.click(".account-row"); await w.waitForSelector(".account-pop"); await w.keyboard.press("Escape");
  await w.keyboard.press("Control+Shift+O"); await w.waitForSelector(".welcome");

  await w.click("button[aria-label='サイドバーを閉じる']");
  await w.waitForSelector("button[aria-label='サイドバーを開く']");
  await w.click("button[aria-label='サイドバーを開く']");
  await w.waitForSelector("button[aria-label='サイドバーを閉じる']");

  // Settings: greeting name, light theme, credit tab.
  await w.click(".account-row"); await w.click(".account-pop .menu-item:has-text('設定')");
  await w.fill(".settings input[placeholder*='あいさつ']", "Shota"); await w.keyboard.press("Enter");
  await w.click(".theme-card:has-text('ライト')");
  await w.click(".settings-nav button:has-text('クレジット')");
  await w.click(".settings-close"); await w.waitForSelector(".settings", { state: "detached" });
  await until(() => w.evaluate(() => getComputedStyle(document.body).backgroundColor), v => v === "rgb(250, 249, 245)", { message: "light theme background" });
  assert.equal(await text(w.locator(".welcome h1")), "こんにちは、Shotaさん");
  assert.equal(await text(w.locator(".who")), "ShotaMax 20x プラン");

  // Delete through the row menu and the confirm dialog.
  await w.keyboard.press("Control+Shift+O");
  const before = await w.locator(".chatrow").count();
  assert.equal(before, 2, "the welcome chat and the new chat are listed");
  await w.hover(".chatrow >> nth=0"); await w.click(".chatrow >> nth=0 >> .row-more"); await w.click(".chat-pop .menu-item:has-text('削除')");
  await w.click(".dialog .btn-danger");
  await until(() => w.locator(".chatrow").count(), n => n === before - 1, { message: "one row is deleted" });
  assert.equal(await text(w.locator(".toast")), "会話を削除しました");

  await w.click(".side-nav"); await w.waitForSelector(".chats-page");
  assert.equal(await text(w.locator(".chats-count")), "1 件の会話");
  await w.click(".chats-list button >> nth=0"); await w.waitForSelector(".thread");
};
