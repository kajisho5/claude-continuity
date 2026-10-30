// The past-chats search tool: the model calls search_past_chats and sees the earlier chat.
const { launch, onboard, openSettings, ask, text, assert } = require("../lib.cjs");

module.exports = async function pastChats(ctx) {
  const { w } = await launch(ctx);
  await onboard(w);
  // Off by default, like the Claude apps: turn it on in Settings first.
  await openSettings(w);
  const toggle = w.locator(".toggle-row:has-text('過去の会話を検索して参照する') input");
  assert.equal(await toggle.isChecked(), false, "searching past chats is off by default");
  await toggle.check();
  await w.keyboard.press("Escape"); await w.waitForSelector(".settings", { state: "detached" });
  await w.click(".new-chat"); await ask(w, "四半期の論点を表で");
  await w.click(".new-chat"); await ask(w, "前に話した件を覚えてる？");
  assert.equal(await text(w.locator(".steps > summary")), "過去の会話を検索 1 回");
  await w.click(".steps > summary"); await w.locator(".step details > summary").first().click();
  assert.ok((await text(w.locator(".step-output").first())).includes("四半期"), "the tool output includes the earlier chat's title");
  assert.equal(await text(w.locator(".message.assistant .markdown").last()), "以前の会話では売上が +12% でした。");
  const tools = ctx.mock.log.find(l => l.startsWith("tools "));
  assert.ok(tools && JSON.parse(tools.slice(6)).includes("search_past_chats"), "search_past_chats is offered to the model");
  // Web search, URL reading and code execution are offered in every chat without turning anything on.
  for (const name of ["web_search", "web_fetch", "code_execution"]) assert.ok(JSON.parse(tools.slice(6)).includes(name), `${name} is always offered`);
};
