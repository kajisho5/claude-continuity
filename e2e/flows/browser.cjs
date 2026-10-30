// The in-app browser: open a page, go back, give the page (text and image) to Claude, and links in replies open there.
const { launch, onboard, openSettings, until, text, assert } = require("../lib.cjs");

module.exports = async function browser(ctx) {
  const { app, w } = await launch(ctx);
  await onboard(w);
  await w.click(".new-chat");
  await w.click(".open-browser");
  await w.waitForSelector(".browser-panel .browser-empty");
  assert.ok(await w.locator(".browser-send-page").isDisabled(), "nothing to give before a page is open");

  const title = () => text(w.locator(".browser-title"));
  await w.fill(".browser-address", "127.0.0.1:8787/page"); await w.press(".browser-address", "Enter");
  await until(title, t => t === "テストのページ", { timeout: 15000, message: "first page loads" });
  assert.equal(await w.inputValue(".browser-address"), "http://127.0.0.1:8787/page");
  assert.equal(await w.locator(".browser-panel .browser-empty").count(), 0);

  await w.fill(".browser-address", "http://127.0.0.1:8787/page2"); await w.press(".browser-address", "Enter");
  await until(title, t => t === "二ページ目", { timeout: 15000, message: "second page loads" });
  await until(() => w.locator(".browser-back").isEnabled(), Boolean, { message: "back is enabled" });
  await w.click(".browser-back");
  await until(title, t => t === "テストのページ", { message: "back to the first page" });

  // The page view sits exactly over the panel's page area.
  const area = await w.locator(".browser-view").boundingBox();
  const view = await app.evaluate(({ BrowserWindow }) => {
    const child = BrowserWindow.getAllWindows()[0].contentView.children[0];
    return child && { ...child.getBounds(), visible: child.getVisible() };
  });
  assert.ok(view && view.visible, "the page view is shown");
  for (const k of ["x", "y", "width", "height"]) assert.ok(Math.abs(view[k] - area[k]) <= 1, `view ${k} ${view[k]} matches the panel ${area[k]}`);

  await w.click(".browser-send-page");
  await w.click(".composer .attachment-chip:has-text('テストのページ.md') .chip-open");
  await until(() => text(w.locator(".viewer-text")), t => t.includes("A10 は約 9 万円です。") && t.includes("http://127.0.0.1:8787/page"), { message: "the page text is attached" });
  await w.keyboard.press("Escape");
  await w.click(".browser-send-capture");
  await w.waitForSelector(".composer .attachment-chip:has-text('.png')");

  // Dialogs are drawn by the app page, under the native page view: it steps aside while one is open.
  const viewVisible = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children[0]?.getVisible() ?? false);
  await openSettings(w);
  await until(viewVisible, v => v === false, { message: "the page view hides under settings" });
  await w.keyboard.press("Escape"); await w.waitForSelector(".settings", { state: "detached" });
  await until(viewVisible, v => v === true, { message: "the page view comes back" });

  // Closing drops the page; a link opened from the app window brings the panel back with that page.
  await w.click(".browser-close");
  await w.waitForSelector(".browser-panel", { state: "detached" });
  await w.evaluate(() => { window.open("http://127.0.0.1:8787/page2"); });
  await w.waitForSelector(".browser-panel");
  await until(title, t => t === "二ページ目", { timeout: 15000, message: "a link opens in the panel" });
  assert.equal(ctx.mock.log.filter(l => l === "GET /page2").length >= 2, true);
};
