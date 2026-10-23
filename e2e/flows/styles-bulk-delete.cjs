// A custom style generated from a writing sample, used in a chat; then bulk delete on the chats page.
const { launch, onboard, ask, openSettings, until, text, assert } = require("../lib.cjs");

module.exports = async function stylesBulkDelete(ctx) {
  const { w } = await launch(ctx);
  await onboard(w);
  await openSettings(w, "スタイルとメモリ");
  await w.click("text=文章サンプルから作成");
  await w.fill(".style-sample textarea", "結論から言うと、売上は伸びた。理由は三つ。新商品、値上げ、販路拡大。以上、簡潔に報告する。");
  await w.click("text=このサンプルからスタイルを作る"); await w.waitForSelector(".style-editor");
  assert.ok((await w.locator(".style-editor textarea").inputValue()).includes("結論を一文目に書く"), "the generated instructions fill the editor");
  await w.fill(".style-editor input", "報告調"); await w.click("text=スタイルを保存");
  await until(() => w.evaluate(() => window.continuity.loadPrefs()), p => JSON.stringify(p).includes("報告調"), { message: "the style is saved to prefs" });
  await w.keyboard.press("Escape");

  await w.click(".new-chat"); await w.click(".tools .round-btn"); await w.click(".tools-style"); await w.click(".style-list .menu-item:has-text('報告調')");
  assert.equal(await text(w.locator(".style-chip")), "報告調");
  await ask(w, "四半期の論点を表で");
  const params = ctx.mock.log.filter(l => l.startsWith("params ")).map(l => JSON.parse(l.slice(7))).filter(p => p.stream);
  assert.ok(JSON.stringify(params[params.length - 1].system).includes("結論を一文目に書く"), "the style reaches the system prompt");

  await w.click(".new-chat"); await ask(w, "二つ目の会話");
  await w.click(".side-nav:has-text('チャット')"); await w.click(".chats-toolbar button:has-text('選択')");
  await w.click(".chats-list li >> nth=0 >> button"); await w.click(".chats-list li >> nth=1 >> button");
  await w.click(".chats-toolbar .btn-danger"); await w.click(".dialog .btn-danger");
  await until(() => w.locator(".chats-title").allTextContents(), l => l.length === 1, { message: "two chats deleted" });
  assert.deepEqual(await w.locator(".chats-title").allTextContents(), ["はじめに"]);
  assert.equal(await text(w.locator(".toast").last()), "2 件の会話を削除しました");
};
