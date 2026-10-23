// Export a chat as a standalone HTML file.
const fs = require("node:fs");
const path = require("node:path");
const { launch, onboard, ask, until, text, assert } = require("../lib.cjs");

module.exports = async function exportHtml(ctx) {
  const out = path.join(ctx.tmp, "export-test.html");
  const { app, w } = await launch(ctx);
  await onboard(w);
  await w.click(".new-chat"); await ask(w, "四半期の論点を表で");
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, out);
  await w.click(".title-trigger"); await w.click(".chat-pop .menu-item:has-text('HTML で書き出す')");
  const html = await until(() => fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "", s => s.includes("</html>"), { message: "export file is written" });
  assert.ok(html.length > 2000, `export is ${html.length} bytes`);
  assert.ok(html.includes("<table>"), "markdown tables are rendered");
  assert.ok(html.includes("四半期の論点を表で"), "user text is included");
  assert.ok(!/<script[\s>]/i.test(html), "the export has no scripts");
  assert.equal(await text(w.locator(".toast").last()), "HTML に書き出しました。ブラウザで開いて共有できます");
};
