// Profile settings, and incognito chats that are never written to disk or listed.
const fs = require("node:fs");
const path = require("node:path");
const { launch, onboard, ask, openSettings, until, assert } = require("../lib.cjs");

module.exports = async function profileIncognito(ctx) {
  const { w } = await launch(ctx);
  await onboard(w);
  await openSettings(w);
  await w.fill(".settings input[placeholder*='あいさつ']", "Shota"); await w.keyboard.press("Enter");
  await w.click(".settings .toggle-row:has-text('この名前で呼んでもらう') input");
  // Closing with Esc right after typing (no blur) still saves the instructions.
  await w.fill(".settings textarea[placeholder*='経営企画']", "回答は結論から書いてください。");
  await w.keyboard.press("Escape"); await w.waitForSelector(".settings", { state: "detached" });
  await until(() => w.evaluate(() => window.continuity.loadPrefs()), p => p.preferences === "回答は結論から書いてください。", { message: "instructions saved on Esc" });

  await w.click(".new-chat"); await ask(w, "通常の会話です");
  // The profile reaches the system prompt.
  const params = ctx.mock.log.filter(l => l.startsWith("params ")).map(l => JSON.parse(l.slice(7))).filter(p => p.stream);
  const sys = JSON.stringify(params[params.length - 1].system);
  assert.ok(sys.includes("Shota") && sys.includes("回答は結論から書いてください。"), "name and preferences are in the system prompt");

  await w.click(".new-chat"); await w.click(".incognito-toggle");
  await ask(w, "秘密の相談です");
  assert.equal(await w.locator(".incognito-badge").count(), 1);
  assert.deepEqual(await w.locator(".chatrow").allTextContents(), ["四半期の論点", "はじめに"], "the incognito chat is not listed");

  const chatsFile = path.join(ctx.userDataDir, "claude-continuity", "chats.json");
  const saved = await until(() => fs.existsSync(chatsFile) ? fs.readFileSync(chatsFile, "utf8") : "", s => s.includes("通常の会話"), { message: "normal chat is saved" });
  assert.ok(!saved.includes("秘密の相談"), "the incognito chat is not saved");

  await w.click(".chatrow >> nth=0 >> .chatlink");
  await w.click(".side-nav:has-text('チャット')"); await w.waitForSelector(".chats-page");
  assert.deepEqual(await w.locator(".chats-title").allTextContents(), ["四半期の論点", "はじめに"], "the incognito chat is gone after leaving it");
  // Search covers the whole conversation, not only the title and the last reply.
  await w.fill(".chats-search input", "通常の会話です");
  assert.deepEqual(await w.locator(".chats-title").allTextContents(), ["四半期の論点"], "full-text search finds the chat by a user message");
};
