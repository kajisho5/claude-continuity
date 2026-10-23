// Research mode: live activity counter, steps summary and the structured report.
const { launch, onboard, text, assert } = require("../lib.cjs");

module.exports = async function research(ctx) {
  const { w } = await launch(ctx);
  await onboard(w);
  await w.click(".new-chat"); await w.click(".tools .round-btn");
  assert.equal(await text(w.locator(".tools-item b").first()), "リサーチ");
  await w.locator(".tools-item").first().locator("input").check(); await w.keyboard.press("Escape");
  assert.deepEqual(await w.locator(".tool-chip").allTextContents(), ["リサーチ"]);

  await w.fill(".composer textarea", "EV の市場動向を調べて"); await w.keyboard.press("Enter");
  await w.waitForSelector(".message.pending", { timeout: 3000 }).catch(() => {});
  const seen = []; const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const a = await w.locator(".message.pending .activity").textContent({ timeout: 500 }).catch(() => null);
    if (a && seen[seen.length - 1] !== a) seen.push(a);
    if (!(await w.locator(".message.pending").count())) break;
    await w.waitForTimeout(100);
  }
  await w.waitForSelector(".message.pending", { state: "detached", timeout: 30000 });
  assert.equal(seen[0], "リサーチ中… 検索 1 回 · ページ 0 件", `activity: ${JSON.stringify(seen)}`);
  assert.ok(seen.includes("リサーチ中… 検索 2 回 · ページ 0 件"), `activity: ${JSON.stringify(seen)}`);
  assert.equal(seen[seen.length - 1], "リサーチ中… 検索 2 回 · ページ 1 件", `activity: ${JSON.stringify(seen)}`);

  const last = w.locator(".message.assistant").last();
  assert.equal(await text(last.locator(".steps > summary")), "検索 2 回 · ページ読込 1 件");
  assert.deepEqual(await last.locator("h2").allTextContents(), ["結論", "詳細", "不確実な点"]);
  const req = ctx.mock.log.find(l => l.startsWith("research "));
  assert.ok(req && JSON.parse(req.slice(9)).tools.includes("web_search:20"), `research request: ${req}`);
};
