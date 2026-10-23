// Hand a chat over to Claude Desktop / claude.ai with a generated summary or the raw transcript.
const { launch, onboard, ask, text, assert } = require("../lib.cjs");

module.exports = async function handoff(ctx) {
  const { app, w } = await launch(ctx);
  await onboard(w);
  await app.evaluate(({ shell }) => { globalThis.__opened = []; shell.openExternal = async (url) => { globalThis.__opened.push(url); }; });
  await w.click(".new-chat"); await ask(w, "四半期の論点を表で");

  await w.click(".handoff-btn"); await w.waitForSelector(".modal.handoff");
  await w.click("text=引き継ぎメモを作成"); await w.waitForSelector(".handoff-text");
  const summary = await w.locator(".handoff-text").inputValue();
  assert.ok(summary.startsWith("これは別のアプリ（Claude API）で続けていた会話「四半期の論点」の引き継ぎメモです。"), summary.slice(0, 80));
  assert.ok(summary.includes("## 目的") && summary.includes("CAC 悪化の要因分析"), "the generated summary is included");

  await w.click("text=Claude デスクトップで開く"); await w.waitForSelector(".modal.handoff", { state: "detached" });
  const [desktopUrl] = await app.evaluate(() => globalThis.__opened);
  assert.ok(desktopUrl.startsWith("claude://claude.ai/new?q="), desktopUrl.slice(0, 40));
  assert.equal(decodeURIComponent(desktopUrl.slice("claude://claude.ai/new?q=".length)), summary, "the summary is passed in the deep link");
  assert.equal(await text(w.locator(".toast").last()), "Claude アプリを開きました。内容を確認して送信してください");

  await w.click(".handoff-btn"); await w.click("text=最近のやり取りをそのまま");
  const transcript = await w.locator(".handoff-text").inputValue();
  assert.match(transcript, /【私】[\s\S]*【Claude】/);
  await w.click("text=ブラウザの claude.ai で開く"); await w.waitForTimeout(300);
  const opened = await app.evaluate(() => globalThis.__opened);
  assert.equal(opened[1], "https://claude.ai/new");
  const clip = await app.evaluate(({ clipboard }) => clipboard.readText());
  assert.ok(clip.startsWith("これは別のアプリ（Claude API）で続けていた会話の引"), "the transcript is copied for pasting");
  assert.ok(clip.includes("【私】"));
};
