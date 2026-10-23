// Local (stdio) MCP servers: import from the Claude Desktop config, secret env storage, connection test,
// manual add with env validation, and the per-call approval prompt (deny / once / always).
const fs = require("node:fs");
const path = require("node:path");
const { launch, onboard, waitReply, until, text, assert } = require("../lib.cjs");
const { makeDesktopConfig, localMcpServer } = require("../fixtures/generate.cjs");

async function send(w, msg) { await w.fill(".composer textarea", msg); await w.keyboard.press("Enter"); }
const lastReply = w => w.locator(".message.assistant").last().innerText();

module.exports = async function localMcp(ctx) {
  const { w } = await launch(ctx, { env: { CONTINUITY_DESKTOP_CONFIG: require("node:path").join(makeDesktopConfig(ctx.tmp), "Claude", "claude_desktop_config.json") } });
  await onboard(w);
  await w.click(".new-chat"); await w.click(".tools .round-btn"); await w.click(".tools-menu .menu-item:last-child");
  await w.waitForSelector(".settings .connector-list");

  await w.click(".import-desktop"); await w.waitForSelector(".import-notice");
  assert.equal(await text(w.locator(".import-notice")), "1 個のローカル MCP サーバーを追加しました。");
  assert.equal(await text(w.locator(".connector-text b").first()), "echo-testローカル");
  assert.equal(await text(w.locator(".connector-text small").first()), `node ${localMcpServer()} · 環境変数 1 個`);
  await w.click(".import-desktop");
  await until(() => text(w.locator(".import-notice")), t => t === "1 個のサーバーはすべて登録済みです。", { message: "second import adds nothing" });
  const stored = fs.readFileSync(path.join(ctx.userDataDir, "claude-continuity", "connectors.json"), "utf8");
  assert.ok(stored.includes("echo-test"), "the connector is stored");
  assert.ok(!stored.includes("secret-prefix"), "the env value is not stored in plain text");

  await w.click(".connector-list button:has-text('接続テスト')");
  const result = await until(() => text(w.locator(".connector-text small").last()), t => /ツール|失敗|エラー/.test(t), { timeout: 60000, message: "connection test finishes" });
  assert.equal(result, "接続できました · ツール 2 個（echo, add）");

  // Add one by hand.
  await w.click(".form-actions.start .btn-secondary >> nth=0"); await w.click(".connector-form [role=tab] >> nth=1");
  await w.fill(".connector-form input >> nth=0", "手動"); await w.fill(".connector-form input >> nth=1", "node");
  await w.fill(".connector-form input >> nth=2", `"${localMcpServer()}"`); await w.fill(".connector-form textarea", "ECHO_PREFIX=manual\nBAD NAME=x");
  await w.click(".connector-form .btn-primary");
  assert.equal(await text(w.locator(".connector-form .form-message")), "環境変数の名前が正しくありません: BAD NAME");
  await w.fill(".connector-form textarea", "ECHO_PREFIX=manual"); await w.click(".connector-form .btn-primary"); await w.waitForSelector(".connector-form", { state: "detached" });
  assert.deepEqual(await w.locator(".connector-text b").allTextContents(), ["echo-testローカル", "手動ローカル"]);
  await w.keyboard.press("Escape");
  await w.click(".tools .round-btn"); await w.click(".tools-item:has-text('echo-test') input"); await w.keyboard.press("Escape");

  // 1) Deny
  await send(w, "ローカルでエコーして");
  await w.waitForSelector(".tool-approval", { timeout: 60000 });
  assert.equal(await text(w.locator(".tool-approval b")), "Claude が echo-test の「echo」を使おうとしています");
  await w.click(".approval-deny"); await waitReply(w, 60000);
  assert.ok((await lastReply(w)).includes("失敗: ユーザーがこのツールの実行を許可しませんでした。"), "denying returns an error to the model");

  // 2) Allow once
  await send(w, "ローカルでもう一度");
  await w.waitForSelector(".tool-approval", { timeout: 60000 }); await w.click(".approval-once"); await waitReply(w, 60000);
  assert.ok((await lastReply(w)).includes("ECHO(secret-prefix): こんにちは"), "the tool runs with the stored env");

  // 3) Always allow; the next call runs without asking.
  await send(w, "ローカルで三回目");
  await w.waitForSelector(".tool-approval", { timeout: 60000 }); await w.click(".approval-always"); await waitReply(w, 60000);
  await send(w, "ローカルで四回目");
  await w.waitForSelector(".message.pending", { timeout: 3000 }).catch(() => {});
  let asked = false; const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    if (await w.locator(".tool-approval").count()) { asked = true; break; }
    if (!(await w.locator(".message.pending").count())) break;
    await w.waitForTimeout(100);
  }
  assert.equal(asked, false, "no second prompt after always-allow");
  await waitReply(w, 60000);
  assert.ok((await lastReply(w)).includes("ECHO(secret-prefix)"));
  await w.locator(".message.assistant").last().locator(".steps > summary").click();
  assert.equal(await text(w.locator(".message.assistant").last().locator(".step-label").first()), "echo-test: echo");
};
