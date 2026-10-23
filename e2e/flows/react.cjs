// A React artifact using lucide-react and recharts runs offline in the sandboxed frame.
const { launch, onboard, ask, until, text, assert } = require("../lib.cjs");

module.exports = async function react(ctx) {
  const { w } = await launch(ctx);
  const external = [];
  w.on("request", r => { if (!/^(file|data|blob|devtools|about):|127\.0\.0\.1/.test(r.url())) external.push(r.url()); });
  await onboard(w);
  await w.click(".new-chat"); await ask(w, "Reactでカウンターを作って");
  assert.deepEqual(await w.locator(".artifact-card b").allTextContents(), ["Counter"]);
  assert.deepEqual(await w.locator(".artifact-card small").allTextContents(), ["React · 15 行 · クリックして開く"]);
  await w.click(".artifact-card >> nth=0"); await w.waitForSelector(".artifact-panel iframe", { timeout: 20000 });
  const frame = await until(async () => w.frames().find(f => f !== w.mainFrame()), Boolean, { message: "artifact frame" });
  const h1 = frame.locator("h1");
  await until(() => h1.textContent({ timeout: 1000 }).catch(() => null), t => t === "カウンター 0", { timeout: 20000, message: "the component renders" });
  await frame.click("#inc"); await frame.click("#inc");
  await until(() => h1.textContent(), t => t === "カウンター 2", { message: "state updates on click" });
  assert.notEqual(await h1.evaluate(e => getComputedStyle(e).color), "rgb(0, 0, 0)", "Tailwind classes apply");
  assert.equal(await frame.locator("button svg").count(), 1, "lucide icon renders");
  await until(() => frame.locator(".recharts-bar-rectangle").count(), n => n === 3, { message: "recharts renders 3 bars" });
  assert.ok((await text(w.locator(".artifact-panel .hint"))).includes("React・lucide-react・recharts・Tailwind"));
  assert.deepEqual(external, [], "no external requests");
};
