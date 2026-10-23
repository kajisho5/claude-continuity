// Projects with instructions and memory, pasted attachments, web search + file creation tools,
// styles, steps/sources/file cards, sandboxed HTML artifact, edit + regenerate versions,
// attachment viewers, shortcuts dialog and the memory editor.
const { launch, onboard, waitReply, until, text, assert } = require("../lib.cjs");

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

module.exports = async function projects(ctx) {
  const { w } = await launch(ctx);
  await onboard(w);

  await w.click(".side-nav:has-text('プロジェクト')"); await w.waitForSelector(".projects-empty");
  await w.click(".projects-empty .btn-primary");
  await w.fill(".modal input.text-input", "Q3 レポート");
  await w.fill(".modal textarea.text-input", "金額は円で表示し、結論を先に書いてください。");
  await w.click(".modal .toggle-row input.switch"); // project memory on
  await w.click(".modal .actions .btn-primary"); await w.waitForSelector(".modal", { state: "detached" });
  await w.waitForSelector(".project-page");
  await w.click(".project-start"); await w.waitForSelector(".welcome");
  assert.equal(await w.locator(".project-select").evaluate(e => e.options[e.selectedIndex].text), "Q3 レポート");

  // Paste an image and a CSV.
  await w.evaluate((png) => {
    const bin = Uint8Array.from(atob(png), c => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bin], "chart.png", { type: "image/png" }));
    dt.items.add(new File(["month,sales\n7,100\n8,120\n"], "sales.csv", { type: "text/csv" }));
    document.querySelector(".composer textarea").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG);
  await w.waitForSelector(".composer .attachment-chip >> nth=1");
  assert.equal(await w.locator(".composer .attachment-chip").count(), 2);
  assert.equal(await w.locator(".composer .attachment-chip img").count(), 1, "the image chip has a thumbnail");

  await w.click(".tools .round-btn");
  await w.click(".tools-item:has-text('Web 検索') input"); await w.click(".tools-item:has-text('ファイル作成') input");
  await w.keyboard.press("Escape");
  assert.deepEqual(await w.locator(".tool-chip").allTextContents(), ["Web検索", "ファイル作成", "メモリ"]);
  await w.click(".tools .round-btn"); await w.click(".tools-style"); await w.click(".style-list .menu-item:has-text('簡潔')");
  assert.equal(await text(w.locator(".style-chip")), "簡潔");

  await w.fill(".composer textarea", "この表と画像を分析して html も作って");
  await w.keyboard.press("Enter");
  await waitReply(w, 30000);
  await until(() => text(w.locator(".status-text")), t => t.startsWith("応答完了"), { message: "status shows completion" });
  const status = await text(w.locator(".status-text"));
  assert.match(status, /^応答完了 · 10,000 input \/ 840 output tokens · 検索 1回 · 推定 \$\d+\.\d{4}$/);
  assert.equal(await text(w.locator(".steps > summary").first()), "検索 1 回 · コード実行 1 回 · メモリ 1 回");
  await w.click(".steps > summary"); await w.locator(".step details > summary").first().click();
  assert.deepEqual(await w.locator(".step-label").allTextContents(), ["メモリに保存: /memories/prefs.md", "「2026 Q3 小売 売上」を検索", "コードを実行"]);
  assert.equal(await w.locator(".sources .source").count(), 1);
  const cards = await w.locator(".file-card").allTextContents();
  assert.equal(cards.length, 1); assert.ok(cards[0].includes("q3-summary.xlsx"), cards[0]);
  assert.equal(await w.locator(".markdown a[title]").first().getAttribute("href"), "https://stat.example.go.jp/q3", "citation links to the source");
  assert.equal(await text(w.locator(".title-trigger span")), "四半期売上の分析");
  assert.match(await text(w.locator(".artifact-card")), /HTML · 1 行/);

  // The HTML artifact runs in a sandboxed frame without access to the app.
  await w.click(".artifact-card"); await w.waitForSelector(".artifact-frame");
  const frame = await until(async () => w.frames().find(f => f !== w.mainFrame()), Boolean, { message: "artifact frame" });
  await until(() => frame.locator("h1").textContent().catch(() => null), t => t === "売上グラフ (JS ok)", { message: "artifact script ran" });
  assert.equal(await frame.evaluate(() => { try { return !!window.parent.document; } catch { return false; } }), false, "artifact cannot reach the parent");
  await w.click("button[aria-label='閉じる'] >> nth=0").catch(() => {});

  // Edit the user turn: versions with their own replies.
  await w.locator(".message.user").last().hover(); await w.locator(".message.user button[aria-label=編集]").last().click();
  await w.fill(".edit-box textarea", "再生成テスト");
  await w.click(".edit-box button:has-text('保存して送信')");
  await waitReply(w);
  await w.locator(".message.user").last().hover();
  assert.equal(await text(w.locator(".message.user .alt-switch").last()), "2 / 2");
  await w.locator(".message.user button[aria-label='前の版']").last().click();
  await until(() => text(w.locator(".user-bubble").last()), t => t === "この表と画像を分析して html も作って", { message: "back to v1" });
  assert.equal(await w.locator(".message.assistant").count(), 1);
  await w.locator(".message.user").last().hover(); await w.locator(".message.user button[aria-label='次の版']").last().click();
  await until(() => text(w.locator(".user-bubble").last()), t => t === "再生成テスト", { message: "forward to v2" });

  // Attachment viewers (v2 keeps the attachments).
  await w.locator(".message.user .attachment-chip.kind-text .chip-open").first().click(); await w.waitForSelector(".viewer-text");
  assert.ok((await w.locator(".viewer-text").textContent()).startsWith("month,sales\n7,100"));
  await w.keyboard.press("Escape");
  await w.locator(".message.user .attachment-chip.kind-image .chip-open").first().click(); await w.waitForSelector(".viewer-box img");
  await w.keyboard.press("Escape");

  // Regenerate: two alternatives for the reply.
  await w.locator("button[aria-label=再生成]").click();
  await waitReply(w);
  assert.equal(await text(w.locator(".message.assistant .alt-switch")), "2 / 2");
  assert.ok((await text(w.locator(".message.assistant .markdown").last())).length > 0);
  await w.click("button[aria-label='前の回答']");
  await textEventuallyTrim(w.locator(".message.assistant .alt-switch"), "1 / 2");

  await w.click(".crumb-project"); await w.waitForSelector(".project-page .chats-list li");
  assert.deepEqual(await w.locator(".project-page .chats-title").allTextContents(), ["四半期売上の分析"]);
  await w.click(".side-nav:has-text('プロジェクト')"); await w.waitForSelector(".project-card");
  assert.match(await text(w.locator(".project-card small")), /^会話 1 件 · 更新 /);

  await w.keyboard.press("Control+Shift+?"); await w.waitForSelector(".modal.shortcuts");
  await w.keyboard.press("Escape"); await w.waitForSelector(".modal.shortcuts", { state: "detached" });

  // Memory written by the memory tool, edited and added to in settings.
  await w.click(".account-row"); await w.click(".account-pop .menu-item:has-text('設定')"); await w.click(".settings-nav button:has-text('スタイルとメモリ')");
  await w.waitForSelector(".memory-list li");
  assert.deepEqual(await w.locator(".memory-list code").allTextContents(), ["/memories/prefs.md"]);
  await w.click(".memory-list button[aria-label$='を編集']"); await w.fill(".memory-edit textarea", "- 金額は円で表示（編集済み）"); await w.click(".memory-edit button:has-text('保存')");
  await w.waitForSelector(".memory-edit", { state: "detached" });
  await w.click(".memory-list summary");
  assert.equal(await text(w.locator(".memory-list pre").first()), "- 金額は円で表示（編集済み）");
  await w.click("text=メモリを書き足す"); await w.fill(".memory-edit.new input", "好み.md"); await w.fill(".memory-edit.new textarea", "資料は A4 横"); await w.click(".memory-edit.new button:has-text('追加')");
  await until(() => w.locator(".memory-list code").allTextContents(), l => l.length === 2, { message: "memory file added" });
  assert.deepEqual(await w.locator(".memory-list code").allTextContents(), ["/memories/prefs.md", "/memories/好み.md"]);
  assert.ok(ctx.mock.log.includes("upload sales.csv"), "the CSV went to code execution through the Files API");
};

const textEventuallyTrim = (loc, expected) => until(() => text(loc), t => t === expected, { message: `${loc} should be ${expected}` });
module.exports.mock = "api-projects";
