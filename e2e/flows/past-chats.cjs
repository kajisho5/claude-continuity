// The past-chats search tool: the model calls search_past_chats and sees the earlier chat.
const { launch, onboard, ask, text, assert } = require("../lib.cjs");

module.exports = async function pastChats(ctx) {
  const { w } = await launch(ctx);
  await onboard(w);
  await w.click(".new-chat"); await ask(w, "四半期の論点を表で");
  await w.click(".new-chat"); await ask(w, "前に話した件を覚えてる？");
  assert.equal(await text(w.locator(".steps > summary")), "過去の会話を検索 1 回");
  await w.click(".steps > summary"); await w.locator(".step details > summary").first().click();
  assert.ok((await text(w.locator(".step-output").first())).includes("四半期"), "the tool output includes the earlier chat's title");
  assert.equal(await text(w.locator(".message.assistant .markdown").last()), "以前の会話では売上が +12% でした。");
  const tools = ctx.mock.log.find(l => l.startsWith("tools "));
  assert.ok(tools && JSON.parse(tools.slice(6)).includes("search_past_chats"), "search_past_chats is offered to the model");
};
