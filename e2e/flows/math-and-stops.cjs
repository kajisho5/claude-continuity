// KaTeX math (with dollar amounts left alone), max_tokens stop with "continue" merging, and refusal.
const { launch, onboard, ask, waitReply, until, text, assert } = require("../lib.cjs");

module.exports = async function mathAndStops(ctx) {
  const { w } = await launch(ctx);
  await onboard(w);
  await w.click(".new-chat");

  await ask(w, "数式を書いて");
  assert.equal(await w.locator(".markdown .katex").count(), 3, "inline + display formulas render with KaTeX");
  assert.equal(await w.locator(".markdown .katex-display").count(), 1);
  assert.ok((await text(w.locator(".message.assistant .markdown").last())).includes("$10 と $200"), "prices are not parsed as math");

  await ask(w, "長文で説明して");
  assert.equal(await text(w.locator(".stop-notice span")), "出力の上限に達したため、回答が途中で終わっています。");
  await w.click(".stop-notice button:has-text('続ける')");
  await waitReply(w);
  await until(() => text(w.locator(".message.assistant .markdown").last()), t => t === "長い説明の前半です。ここで出力が途切れた後の続きです。おわり。", { message: "continuation merges into the cut reply" });
  assert.equal(await w.locator(".stop-notice").count(), 0, "notice is gone after continuing");
  assert.equal(await w.locator(".message.assistant").count(), 2);

  await ask(w, "拒否して");
  assert.equal(await text(w.locator(".stop-notice.refusal span")), "Claude はこの依頼への回答を控えました。言い方や内容を変えて、もう一度お試しください。");
  assert.equal(await w.locator(".stop-notice.refusal button").count(), 0, "a refusal offers no continue button");
};
