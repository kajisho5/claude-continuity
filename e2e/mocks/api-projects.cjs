// Mock Anthropic API used by the projects flow: projects, memory tool, Files API, web search and code execution.
// Standalone: `node e2e/mocks/api-projects.cjs [logfile]` (listens on 8787, writes the request log on SIGTERM).
const http = require("node:http"); const fs = require("node:fs");
const caps = (adaptive) => ({ effort: { supported: true, low: { supported: true }, medium: { supported: true }, high: { supported: true }, xhigh: { supported: true }, max: { supported: true } },
  thinking: { supported: adaptive, types: { adaptive: { supported: adaptive } } }, image_input: { supported: true }, pdf_input: { supported: true },
  server_tools: { supported: true, web_search: { supported: true }, code_execution: { supported: true } } });
const models = [
  { type: "model", id: "claude-opus-5-5", display_name: "Claude Opus 5.5", created_at: "2026-09-21T00:00:00Z", max_tokens: 128000, capabilities: caps(true) },
  { type: "model", id: "claude-haiku-4-5-20251001", display_name: "Claude Haiku 4.5", created_at: "2025-10-01T00:00:00Z", max_tokens: 64000, capabilities: { ...caps(false), effort: { supported: false } } }
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Starts the mock on `port`; resolves to { log, close } where `log` is the live request log. */
function start(port = 8787) {
  const log = [];
  let regenCount = 0;
  const server = http.createServer((req, res) => {
  const chunks = []; req.on("data", c => chunks.push(c)); req.on("end", async () => {
    const raw = Buffer.concat(chunks);
    log.push(`${req.method} ${req.url}`);
    const json = o => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
    if (req.url.startsWith("/v1/models")) return json({ data: models, has_more: false, first_id: "a", last_id: "b" });
    if (req.method === "POST" && req.url.startsWith("/v1/files")) { log.push("upload " + (raw.toString("latin1").match(/filename="([^"]+)"/) || [])[1]); return json({ id: "file_up" + log.length, type: "file", filename: "x", mime_type: "text/csv", size_bytes: raw.length, created_at: "2026-10-23T00:00:00Z" }); }
    if (req.url.startsWith("/v1/files/file_abc/content")) { res.setHeader("content-type", "application/octet-stream"); return res.end(Buffer.from("PK-fake-xlsx")); }
    if (req.url.startsWith("/v1/files/file_abc")) return json({ id: "file_abc", type: "file", filename: "q3-summary.xlsx", mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size_bytes: 48000, created_at: "2026-10-23T00:00:00Z", downloadable: true });
    if (!req.url.startsWith("/v1/messages")) { res.statusCode = 404; return res.end("{}"); }
    const b = JSON.parse(raw.toString("utf8"));
    const last = b.messages[b.messages.length - 1];
    const lastTypes = Array.isArray(last.content) ? last.content.map(c => c.type) : ["string"];
    log.push("req " + JSON.stringify({ model: b.model, stream: !!b.stream, system: b.system, tools: (b.tools || []).map(t => t.type), container: b.container, cache: b.cache_control, thinking: b.thinking, effort: b.output_config, n: b.messages.length, lastTypes }));
    if (!b.stream) return json({ id: "msg_t", type: "message", role: "assistant", model: b.model, content: [{ type: "text", text: "四半期売上の分析" }], stop_reason: "end_turn", usage: { input_tokens: 120, output_tokens: 9 } });
    res.writeHead(200, { "content-type": "text/event-stream" });
    const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    const tools = (b.tools || []).map(t => t.type);
    const hasToolResult = lastTypes.includes("tool_result");
    ev("message_start", { message: { id: "msg_1", type: "message", role: "assistant", model: b.model, content: [], stop_reason: null, usage: { input_tokens: 5000, output_tokens: 1, cache_creation_input_tokens: 4000, cache_read_input_tokens: 0 } } });
    let i = 0;
    const text = async (t, citations) => {
      ev("content_block_start", { index: i, content_block: { type: "text", text: "", ...(citations ? { citations: [] } : {}) } });
      for (const c of t.match(/[\s\S]{1,16}/g)) { ev("content_block_delta", { index: i, delta: { type: "text_delta", text: c } }); await sleep(15); }
      for (const c of citations || []) ev("content_block_delta", { index: i, delta: { type: "citations_delta", citation: c } });
      ev("content_block_stop", { index: i }); i++;
    };
    if (tools.includes("memory_20250818") && !hasToolResult) {
      await text("メモリを確認します。");
      ev("content_block_start", { index: i, content_block: { type: "tool_use", id: "toolu_mem", name: "memory", input: {} } });
      ev("content_block_delta", { index: i, delta: { type: "input_json_delta", partial_json: JSON.stringify({ command: "create", path: "/memories/prefs.md", file_text: "- 金額は円で表示する\n" }) } });
      ev("content_block_stop", { index: i }); i++;
      ev("message_delta", { delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 40 } });
      ev("message_stop", {}); return res.end();
    }
    const isRegen = /再生成テスト/.test(JSON.stringify(b.messages.filter(m => m.role === "user").pop()));
    if (tools.includes("web_search_20250305")) {
      ev("content_block_start", { index: i, content_block: { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: {} } });
      ev("content_block_delta", { index: i, delta: { type: "input_json_delta", partial_json: "{\"query\":\"2026 Q3 小売 売上\"}" } });
      ev("content_block_stop", { index: i }); i++; await sleep(300);
      ev("content_block_start", { index: i, content_block: { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: [{ type: "web_search_result", url: "https://stat.example.go.jp/q3", title: "2026年第3四半期 小売業売上統計", encrypted_content: "enc", page_age: null }] } });
      ev("content_block_stop", { index: i }); i++;
    }
    if (tools.includes("code_execution_20250825")) {
      ev("content_block_start", { index: i, content_block: { type: "server_tool_use", id: "srvtoolu_2", name: "bash_code_execution", input: {} } });
      ev("content_block_delta", { index: i, delta: { type: "input_json_delta", partial_json: "{\"command\":\"python make.py\"}" } });
      ev("content_block_stop", { index: i }); i++; await sleep(300);
      ev("content_block_start", { index: i, content_block: { type: "bash_code_execution_tool_result", tool_use_id: "srvtoolu_2", content: { type: "bash_code_execution_result", stdout: "ok", stderr: "", return_code: 0, content: [{ type: "bash_code_execution_output", file_id: "file_abc" }] } } });
      ev("content_block_stop", { index: i }); i++;
    }
    await text(isRegen ? `再生成された回答 #${++regenCount}` : "## 第3四半期の要点\n\n売上は前年同期比 +12% で、業界平均を上回りました",
      tools.includes("web_search_20250305") && !isRegen ? [{ type: "web_search_result_location", url: "https://stat.example.go.jp/q3", title: "2026年第3四半期 小売業売上統計", encrypted_index: "x", cited_text: "業界平均 +7%" }] : null);
    if (!isRegen) await text("。\n\n```html\n<!doctype html><html><head><title>t</title></head><body><h1 id=\"h\">売上グラフ</h1><div style=\"width:120px;height:80px;background:#578DD9\"></div><script>document.getElementById('h').textContent+=' (JS ok)'</script></body></html>\n```");
    ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null, ...(tools.includes("code_execution_20250825") ? { container: { id: "container_1", expires_at: "2099-01-01T00:00:00Z" } } : {}) }, usage: { output_tokens: 800, server_tool_use: { web_search_requests: tools.includes("web_search_20250305") ? 1 : 0 } } });
    if (tools.includes("code_execution_20250825")) {/* container is reported on message_delta in real API; also emit via final message */}
    ev("message_stop", {}); res.end();
  });
});
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ log, server, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); }) }));
  });
}
module.exports = { start };
if (require.main === module) {
  start(Number(process.env.PORT) || 8787).then(m => {
    console.log("mock up");
    process.on("SIGTERM", () => { if (process.argv[2]) fs.writeFileSync(process.argv[2], m.log.join("\n")); process.exit(0); });
  });
}
