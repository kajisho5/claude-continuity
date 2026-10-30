// A remote MCP connector over HTTPS with a bearer token: validation, connection test, secret storage,
// and a chat that uses it through the MCP connector API.
const fs = require("node:fs");
const path = require("node:path");
const { launch, onboard, ask, until, text, assert } = require("../lib.cjs");

module.exports = async function remoteMcp(ctx) {
  const { w } = await launch(ctx, { env: { NODE_EXTRA_CA_CERTS: ctx.https.certPath } });
  await onboard(w);
  await w.click(".new-chat"); await w.click(".tools .round-btn"); await w.click("text=コネクタを追加（Notion・社内 MCP サーバーなど）");
  await w.waitForSelector(".settings .connector-list");
  await w.click("text=コネクタを追加");
  await w.fill(".connector-form input >> nth=0", "社内Wiki"); await w.fill(".connector-form input >> nth=1", "http://127.0.0.1:8443/mcp");
  await w.click(".connector-form button:has-text('保存')");
  assert.equal(await text(w.locator(".connector-form .form-message")), "URL は https:// で始まる必要があります（API が接続できるのは公開された HTTPS の MCP サーバーだけです）。");
  await w.fill(".connector-form input >> nth=1", "https://127.0.0.1:8443/mcp"); await w.fill(".connector-form input[type=password]", "secret-token");
  await w.click(".connector-form button:has-text('保存')"); await w.waitForSelector(".connector-list li b");

  await w.click(".connector-list button:has-text('接続テスト')");
  const result = await until(() => text(w.locator(".connector-text small").last()), t => !/確認しています/.test(t) && t.length > 0, { timeout: 20000, message: "connection test finishes" });
  assert.equal(result, "接続できました · ツール 2 個（search_wiki, get_page）");
  assert.ok(ctx.https.log.length > 0, "the HTTPS server was reached");
  const stored = fs.readFileSync(path.join(ctx.userDataDir, "claude-continuity", "connectors.json"), "utf8");
  assert.ok(!stored.includes("secret-token"), "the token is not stored in plain text");
  await w.keyboard.press("Escape");

  await w.click(".tools .round-btn"); await w.click(".tools-item:has-text('社内Wiki') input"); await w.keyboard.press("Escape");
  assert.deepEqual(await w.locator(".tool-chip").allTextContents(), ["Web検索", "URL読込", "ファイル作成", "社内Wiki"]);
  await ask(w, "wikiで経費精算を調べて");
  assert.equal(await text(w.locator(".steps > summary")), "コネクタ 1 回");
  await w.click(".steps > summary"); await w.locator(".step details > summary").first().click();
  assert.equal(await text(w.locator(".step-label").first()), "社内Wiki: search_wiki");
  assert.equal(await text(w.locator(".step-output").first()), "経費精算は月末締め");
  const mcp = JSON.parse(ctx.mock.log.find(l => l.startsWith("mcp ")).slice(4));
  assert.equal(mcp.servers.length, 1);
  assert.equal(mcp.servers[0].url, "https://127.0.0.1:8443/mcp");
  assert.equal(mcp.servers[0].authorization_token, "secret-token", "the token is sent to the API");
};
module.exports.https = true;
