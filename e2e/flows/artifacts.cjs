// Mermaid and Markdown artifacts, versioned HTML artifacts and the artifacts page.
const { launch, onboard, ask, until, text, assert } = require("../lib.cjs");

module.exports = async function artifacts(ctx) {
  const { w } = await launch(ctx);
  await onboard(w);
  await w.click(".new-chat"); await ask(w, "承認の図を書いて");
  assert.deepEqual(await w.locator(".artifact-card b").allTextContents(), ["図（flowchart）", "議事録"]);
  await w.click(".artifact-card >> nth=0"); await w.waitForSelector(".artifact-panel iframe", { timeout: 20000 });
  const frame = await until(async () => w.frames().find(f => f !== w.mainFrame()), Boolean, { message: "artifact frame" });
  await until(() => frame.locator("svg").count().catch(() => 0), n => n === 1, { message: "mermaid renders one svg", timeout: 20000 });

  await w.click(".artifact-card >> nth=1"); await w.waitForSelector(".artifact-doc");
  assert.equal(await text(w.locator(".artifact-doc h1")), "議事録");

  await ask(w, "ページ版を作って");
  await w.click(".artifact-card:has-text('売上ダッシュボード')"); await w.waitForSelector(".artifact-panel iframe");
  await ask(w, "ページ版をもう一度");
  await until(() => text(w.locator(".artifact-versions")), t => t === "v2 / 2", { message: "second version is shown" });
  await w.click("button[aria-label='前のバージョン']");
  await until(() => text(w.locator(".artifact-versions")), t => t === "v1 / 2", { message: "previous version" });

  await w.click(".side-nav:has-text('アーティファクト')"); await w.waitForSelector(".artifact-entry");
  assert.deepEqual(await w.locator(".artifact-entry b").allTextContents(), ["図（flowchart）", "議事録", "売上ダッシュボード"]);
  assert.deepEqual(await w.locator(".artifact-entry small").allTextContents(), ["図 · たった今", "文書 · たった今", "HTML · 2 バージョン · たった今"]);
  await w.click(".artifact-entry:has-text('売上ダッシュボード')"); await w.waitForSelector(".artifact-panel");
  assert.equal(await text(w.locator(".artifact-panel header b")), "売上ダッシュボード");
};
