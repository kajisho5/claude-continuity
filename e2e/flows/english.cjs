// English UI (--lang=en-US): no Japanese left in the app chrome, and switching languages works.
const { launch, onboard, ask, openSettings, until, text, assert } = require("../lib.cjs");

const JA = /[぀-ヿ一-鿿]/;
// Allowed: the language picker names Japanese in Japanese, with a hint for Japanese readers.
const ALLOWED = new Set(["日本語", "Switch the display language (言語)"]);

/** Japanese text in the chrome under `sel` (chat content, previews and language samples excluded). */
function jaLeft(w, sel) {
  return w.evaluate(([sel, src]) => {
    const re = new RegExp(src); const out = [];
    const root = document.querySelector(sel); if (!root) return ["<missing " + sel + ">"];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) { const tx = n.textContent.trim(); if (tx && re.test(tx) && !n.parentElement.closest(".message,.markdown,.font-preview,.lang-sample,option,textarea")) out.push(tx.slice(0, 60)); }
    root.querySelectorAll("[aria-label],[placeholder],[data-tip],[title]").forEach(el => ["aria-label", "placeholder", "data-tip", "title"].forEach(a => { const v = el.getAttribute(a); if (v && re.test(v) && !el.closest(".message")) out.push(a + "=" + v.slice(0, 60)); }));
    return [...new Set(out)];
  }, [sel, JA.source]);
}
async function noJapanese(w, sel, where) {
  const left = (await jaLeft(w, sel)).filter(t => !ALLOWED.has(t));
  assert.deepEqual(left, [], `Japanese left in ${where}`);
}

module.exports = async function english(ctx) {
  const { w } = await launch(ctx, { lang: "en-US" });
  await w.waitForSelector(".wizard");
  assert.equal(await w.evaluate(() => document.documentElement.lang + " / " + navigator.language), "en / en-US");
  await noJapanese(w, ".wizard", "wizard step 1");
  await w.click(".plan-option:has-text('Max 20x')"); await w.click(".wizard-actions .btn-primary"); await noJapanese(w, ".wizard", "wizard step 2");
  await w.click(".wizard-actions .btn-primary"); await noJapanese(w, ".wizard", "wizard step 3");
  await w.fill(".wizard input[type=password]", "sk-ant-test-key"); await w.click(".wizard-actions .btn-primary"); await w.waitForSelector(".wizard", { state: "detached" });
  await w.waitForFunction(() => /Opus|Sonnet|Haiku/.test(document.querySelector(".model-trigger")?.textContent || ""));

  await w.click(".new-chat"); await w.waitForSelector(".welcome"); await noJapanese(w, ".shell", "home");
  await ask(w, "Reply with a table");
  assert.ok((await text(w.locator(".message.assistant .markdown").last())).includes("Q3 issues"), "the English reply is shown");
  await noJapanese(w, ".shell", "thread");
  await w.click(".model-trigger"); await w.waitForSelector(".model-pop"); await noJapanese(w, ".model-pop", "model menu");
  await w.keyboard.press("Escape"); await w.mouse.click(700, 300);
  await w.click(".side-nav >> nth=0"); await w.waitForSelector(".chats-page"); await noJapanese(w, ".shell", "chats page");
  await w.click(".side-nav >> nth=1"); await w.waitForTimeout(300); await noJapanese(w, ".shell", "artifacts page");
  await w.click(".side-nav >> nth=2"); await w.waitForTimeout(300); await noJapanese(w, ".shell", "projects page");
  await w.click(".account > button"); await w.waitForSelector(".account .menu-item"); await noJapanese(w, ".account", "account menu");
  await w.click(".account .menu-item >> nth=0"); await w.waitForSelector(".settings");

  const tabs = await w.locator(".settings-nav button").allTextContents();
  assert.deepEqual(tabs, ["General", "API key", "Credits", "Styles & memory", "Skills", "Connectors", "Data & backup", "Claude Code integration", "About"]);
  for (let i = 0; i < tabs.length; i++) {
    await w.click(`.settings-nav button >> nth=${i}`); await w.waitForTimeout(300);
    await noJapanese(w, ".settings", `settings tab ${tabs[i]}`);
  }

  await w.click(".settings-nav button >> nth=0");
  await w.click("[role=radio]:has-text('日本語'), button:has-text('日本語')");
  await until(() => text(w.locator(".settings-nav h2")), t => t === "設定", { message: "switched to Japanese" });
  assert.equal(await w.evaluate(() => document.documentElement.lang), "ja");
  await w.click("[role=radio]:has-text('English'), button:has-text('English')");
  await until(() => text(w.locator(".settings-nav h2")), t => t === "Settings", { message: "switched back to English" });
  assert.equal(await w.evaluate(() => document.documentElement.lang), "en");
};
