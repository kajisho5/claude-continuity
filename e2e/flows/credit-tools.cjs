// Spending tools: the estimate under the composer, spending limits, Batch (half price), long-chat summaries,
// the before-expiry suggestions on the credit card, and turning a connector off.
const { launch, onboard, ask, waitReply, openSettings, until, text, assert } = require("../lib.cjs");

module.exports = async function creditTools(ctx) {
  const { w } = await launch(ctx, { env: { CONTINUITY_BATCH_POLL_MS: "400" } });
  await onboard(w);
  const ta = w.locator(".composer textarea");

  // The estimate follows the draft (count_tokens).
  await w.click(".new-chat");
  await ta.fill("見積もりのテストです");
  await until(() => text(w.locator(".cost-estimate-line")), t => /^送信時の目安：入力 約 [\d,]+ トークン・\$\d+\.\d{3}/.test(t), { message: "estimate line" });
  assert.ok(ctx.mock.log.some(l => l.startsWith("count ")), "count_tokens was called");

  // A per-message limit: confirm before sending.
  await openSettings(w, "クレジット");
  await w.fill(".limit-per-message input", "0.0001");
  await w.click(".limits-save");
  await w.keyboard.press("Escape"); await w.waitForSelector(".settings", { state: "detached" });
  await until(() => text(w.locator(".cost-limits")), t => t.includes("1回の上限 $0.00"), { message: "limits line" });
  await ta.press("Enter");
  await w.waitForSelector(".cost-confirm");
  assert.ok((await text(w.locator(".cost-confirm"))).includes("を超えます"), "the dialog says the limit is passed");
  await w.click(".cost-send");
  await waitReply(w);
  assert.equal(await w.locator(".message.assistant").count(), 1, "sent after confirming");

  // "Don't send": nothing is sent and the draft stays.
  await openSettings(w, "クレジット");
  await w.click(".limit-mode button:has-text('送らない')");
  await w.click(".limits-save");
  await w.keyboard.press("Escape"); await w.waitForSelector(".settings", { state: "detached" });
  await ta.fill("送らないテスト");
  await until(() => text(w.locator(".cost-estimate-line")), t => t.startsWith("送信時の目安"), { message: "estimate for the new draft" });
  await ta.press("Enter");
  await until(() => text(w.locator(".status-text")), t => t.includes("送信しませんでした"), { message: "blocked status" });
  assert.equal(await ta.inputValue(), "送らないテスト", "the draft is kept");
  assert.equal(await w.locator(".message.user").count(), 1, "nothing was sent");
  await openSettings(w, "クレジット");
  await w.fill(".limit-per-message input", "");
  await w.click(".limits-save");
  await w.keyboard.press("Escape"); await w.waitForSelector(".settings", { state: "detached" });
  assert.equal(await w.locator(".cost-limits").count(), 0, "no limits, no limits line");

  // Batch: half price, the reply arrives later in place of the card.
  await w.click(".new-chat");
  await w.click(".tools .round-btn"); await w.click(".tools-item:has-text('Batch') input"); await w.keyboard.press("Escape");
  assert.ok((await w.locator(".tool-chip").allTextContents()).includes("Batch（半額）"));
  await ta.fill("Batch で送るテスト");
  await until(() => text(w.locator(".cost-estimate-line")), t => t.includes("（Batch で半額後）"), { message: "estimate notes the Batch price" });
  await ta.press("Enter");
  await w.waitForSelector(".batch-pending");
  const created = JSON.parse(ctx.mock.log.find(l => l.startsWith("batch create ")).slice(13));
  assert.equal(created.stream, null, "batches are not streamed");
  await w.waitForSelector(".batch-pending", { state: "detached", timeout: 15000 });
  await until(() => text(w.locator(".message.assistant .markdown").last()), t => t.includes("Batch の返答です"), { message: "batch reply in the thread" });
  const usage = await w.evaluate(() => window.continuity.loadUsage());
  assert.ok(usage.some(r => r.batch === true && r.inputTokens === 5000), "the batch request is recorded at batch price");
  await w.click(".nav-batch"); await w.waitForSelector(".batch-page");
  assert.ok((await text(w.locator(".batch-row").first())).includes("完了"));

  // Canceling a batch, then sending the turn normally.
  await w.click(".new-chat");
  await w.click(".tools .round-btn"); await w.click(".tools-item:has-text('Batch') input"); await w.keyboard.press("Escape");
  await ta.fill("ゆっくり Batch で処理");
  await ta.press("Enter");
  await w.waitForSelector(".batch-cancel");
  await w.click(".batch-cancel");
  await w.waitForSelector(".batch-ended.status-canceled", { timeout: 15000 });
  assert.ok(ctx.mock.log.some(l => l.startsWith("batch cancel ")));
  await w.click(".batch-resend");
  await waitReply(w);
  assert.ok((await text(w.locator(".message.assistant .markdown").last())).includes("第3四半期の論点"), "resent normally");

  // Long chats: the turns that no longer fit are sent as the API's summary.
  await w.click(".new-chat");
  await w.click(".model-trigger"); await w.click(".model-pop [role=menuitemradio]:has-text('Sonnet 5.5')"); await w.keyboard.press("Escape");
  await ask(w, "資料A " + "あ".repeat(70000));
  await ask(w, "資料B " + "い".repeat(70000));
  await ask(w, "まとめて");
  const compacts = ctx.mock.log.filter(l => l.startsWith("compact ")).map(l => JSON.parse(l.slice(8)));
  assert.equal(compacts.length, 1, "summarized once, then reused");
  assert.ok(compacts[0].beta.includes("compact-2026-09-04") && compacts[0].first === "user");
  const sent = ctx.mock.log.filter(l => l.startsWith("summary-sent ")).map(l => JSON.parse(l.slice(13)));
  assert.equal(sent.length, 2, "the summary goes first in the following requests");
  assert.ok(sent.every(x => x.role === "assistant" && x.beta.includes("compact-2026-09-04")));
  assert.equal(await text(w.locator(".compaction-divider span.rounded-\\[12px\\]")), "ここより前の 2 件は要約して送っています");
  await w.click(".summary-view");
  assert.ok((await text(w.locator(".summary-text"))).includes("前半で長い資料を共有した"));
  await w.keyboard.press("Escape");
  const saved = await until(() => w.evaluate(() => window.continuity.loadChats()), cs => cs.some(c => c.compaction), { message: "the summary is saved with the chat" });
  assert.equal(saved.find(c => c.compaction).compaction.upto, 2);

  // A model without the API's compaction gets a text summary written by the cheapest Haiku.
  await w.click(".new-chat");
  await w.click(".model-trigger"); await w.click(".model-pop [role=menuitemradio]:has-text('Haiku 4.5')"); await w.keyboard.press("Escape");
  await ask(w, "資料C " + "う".repeat(70000));
  await ask(w, "資料D " + "え".repeat(70000));
  assert.equal(JSON.parse(ctx.mock.log.find(l => l.startsWith("summarize ")).slice(10)).model, "claude-haiku-4-5-20251001");
  assert.ok(ctx.mock.log.some(l => l.startsWith("text-summary ")), "the text summary leads the first kept turn");
  assert.equal(ctx.mock.log.filter(l => l.startsWith("compact ")).length, 1, "no compaction request for this model");

  // Before expiry: suggestions on the credit card when the credit is going unused.
  await w.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 3); return window.continuity.saveCredit({ plan: "max20x", monthlyAmountUsd: 200, resetDay: d.getDate(), onboardingDone: true }); });
  await w.reload(); await w.waitForSelector(".credit-suggestions");
  await w.click(".suggest-batch");
  await w.waitForSelector(".composer .attachment-chip:has-text('past-chats.md')");
  await w.screenshot({ path: require("node:path").join(ctx.tmp, "..", "credit-suggestions.png") });
  assert.ok((await ta.inputValue()).startsWith("添付した過去の会話"));
  assert.ok((await w.locator(".tool-chip").allTextContents()).includes("Batch（半額）"));
  await w.click(".suggest-research");
  assert.ok((await w.locator(".tool-chip").allTextContents()).includes("リサーチ"));
  await w.click(".suggest-dismiss");
  await w.waitForSelector(".credit-suggestions", { state: "detached" });
  assert.ok((await w.evaluate(() => window.continuity.loadPrefs())).suggestDismissedCycle, "dismissed for this cycle");

  // A connector can be turned off without being deleted.
  await w.evaluate(() => window.continuity.saveConnector({ transport: "local", name: "echo-x", command: "node", args: "server.js" }));
  await openSettings(w, "コネクタ"); await w.waitForSelector(".connector-list li");
  await w.click(".connector-enabled");
  await w.waitForSelector(".off-badge");
  assert.equal((await w.evaluate(() => window.continuity.listConnectors()))[0].enabled, false);
  await w.keyboard.press("Escape"); await w.waitForSelector(".settings", { state: "detached" });
  await w.click(".tools .round-btn");
  assert.equal(await w.locator(".tools-item:has-text('echo-x')").count(), 0, "an off connector is not offered");
  await w.keyboard.press("Escape");
};
