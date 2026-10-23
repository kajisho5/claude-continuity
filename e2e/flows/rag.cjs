// Project knowledge too large to inline is searched with a tool instead of being sent as documents.
const { launch, onboard, waitReply, text, assert } = require("../lib.cjs");
const { makeHandbooks, RULE } = require("../fixtures/generate.cjs");

module.exports = async function rag(ctx) {
  const files = makeHandbooks(ctx.tmp);
  const { app, w } = await launch(ctx);
  await onboard(w);
  await app.evaluate(({ dialog }, paths) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths }); }, files);
  await w.click(".side-nav:has-text('プロジェクト')"); await w.click(".projects-empty .btn-primary");
  await w.fill(".modal input.text-input", "社内規程"); await w.click(".modal .field .btn-secondary.small");
  await w.waitForFunction(() => document.querySelector(".modal")?.textContent.includes("handbook-2.txt"), null, { timeout: 15000 });
  await w.click(".modal .actions .btn-primary"); await w.waitForSelector(".modal", { state: "detached" });
  await w.click(".project-start"); await w.waitForSelector(".welcome");
  await w.fill(".composer textarea", "経費精算の締め日は？"); await w.keyboard.press("Enter");
  await waitReply(w);
  const last = w.locator(".message.assistant").last();
  const answer = (await last.innerText()).split("\n").find(l => l.includes("ナレッジより"));
  assert.equal(answer, "ナレッジより: " + RULE);
  assert.equal(await text(last.locator(".steps > summary")), "ナレッジを検索 1 回");
  const reqs = ctx.mock.log.filter(l => l.startsWith("rag ")).map(l => JSON.parse(l.slice(4)));
  assert.equal(reqs.length, 2, "tool call + final answer");
  assert.ok(reqs.every(r => r.documents === 0), "no document blocks are sent");
  assert.ok(reqs[0].note, "the system prompt mentions search_project_knowledge");
};
