// Mock Anthropic API for the e2e flows: models, streaming messages with scripted variants,
// the Skills API, research, local tools, knowledge search and English replies.
// Standalone: `node e2e/mocks/api.cjs [logfile]` (listens on 8787, writes the request log on SIGTERM).
const http = require("node:http"); const fs = require("node:fs");
const caps = (levels, adaptive) => ({ effort: Object.assign({ supported: levels.length > 0 }, ...["low","medium","high","xhigh","max"].map(l => ({ [l]: { supported: levels.includes(l) } }))), thinking: { supported: adaptive, types: { adaptive: { supported: adaptive } } } });
const models = [
  { type: "model", id: "claude-opus-5-5", display_name: "Claude Opus 5.5", created_at: "2026-09-21T00:00:00Z", max_tokens: 128000, max_input_tokens: 1000000, capabilities: caps(["low","medium","high","xhigh","max"], true) },
  { type: "model", id: "claude-sonnet-5-5", display_name: "Claude Sonnet 5.5", created_at: "2026-09-21T00:00:00Z", max_tokens: 128000, capabilities: caps(["low","medium","high","xhigh","max"], true) },
  { type: "model", id: "claude-haiku-4-5-20251001", display_name: "Claude Haiku 4.5", created_at: "2025-10-01T00:00:00Z", max_tokens: 64000, capabilities: caps([], false) }
];
models[0].capabilities.server_tools = { code_execution: { supported: true }, web_search: { supported: true } };
const replyEn = "## Q3 issues\n\n| Issue | Status |\n|---|---|\n| Revenue | **+12%** |\n| CAC | +18% |\n\n```python\nprint(\"hello\")\n```\n\nSee the [official docs](https://platform.claude.com/docs) for details.";
const reply = "## 第3四半期の論点\n\n| 論点 | 状況 |\n|---|---|\n| 売上 | **+12%** |\n| CAC | +18% |\n\n```python\nprint(\"hello\")\n```\n\n詳しくは [公式ドキュメント](https://platform.claude.com/docs) を参照してください。";
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Starts the mock on `port`; resolves to { log, close } where `log` is the live request log. */
function start(port = 8787) {
  const log = [];
  let skills = [];
  // Message Batches: a batch ends a second after it is created (or when canceled).
  const batches = new Map();
  const batchObj = (id) => {
    const b = batches.get(id);
    // "ゆっくり" in the request keeps it processing long enough to cancel.
    const ended = b.canceled || Date.now() - b.created > (b.slow ? 60000 : 1000);
    const n = b.requests.length;
    return { id, type: "message_batch", processing_status: ended ? "ended" : "in_progress",
      request_counts: { processing: ended ? 0 : n, succeeded: ended && !b.canceled ? n : 0, errored: 0, canceled: b.canceled ? n : 0, expired: 0 },
      created_at: new Date(b.created).toISOString(), ended_at: ended ? new Date().toISOString() : null, expires_at: new Date(b.created + 86400000).toISOString(),
      archived_at: null, cancel_initiated_at: b.canceled ? new Date().toISOString() : null, results_url: ended ? `http://127.0.0.1:${port}/v1/messages/batches/${id}/results` : null };
  };
  function batchRoute(req, res, body) {
    res.setHeader("content-type", "application/json");
    const parts = new URL(req.url, "http://x").pathname.split("/").filter(Boolean); // v1 messages batches [id] [results|cancel]
    if (req.method === "POST" && parts.length === 3) {
      const b = JSON.parse(body);
      const id = "msgbatch_" + (batches.size + 1);
      batches.set(id, { created: Date.now(), requests: b.requests, canceled: false, slow: body.includes("ゆっくり") });
      const params = b.requests[0].params;
      log.push("batch create " + JSON.stringify({ beta: req.headers["anthropic-beta"] || "", n: b.requests.length, stream: params.stream ?? null, tools: (params.tools || []).map(t => t.name), messages: params.messages.length }));
      return res.end(JSON.stringify(batchObj(id)));
    }
    const id = parts[3];
    if (!batches.has(id)) { res.statusCode = 404; return res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "not found" } })); }
    if (req.method === "POST" && parts[4] === "cancel") { batches.get(id).canceled = true; log.push("batch cancel " + id); return res.end(JSON.stringify(batchObj(id))); }
    if (parts[4] === "results") {
      const b = batches.get(id);
      res.setHeader("content-type", "application/binary");
      return res.end(b.requests.map(r => JSON.stringify({ custom_id: r.custom_id, result: b.canceled ? { type: "canceled" } : { type: "succeeded", message: { id: "msg_b", type: "message", role: "assistant", model: r.params.model, content: [{ type: "text", text: "Batch の返答です。半額で処理しました。" }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 5000, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } } })).join("\n"));
    }
    return res.end(JSON.stringify(batchObj(id)));
  }
  const server = http.createServer((req, res) => {
  let body = ""; req.on("data", c => body += c); req.on("end", async () => {
    log.push(`${req.method} ${req.url}`);
    if (req.url.startsWith("/v1/models")) { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ data: models, has_more: false, first_id: models[0].id, last_id: models[2].id })); }
    if (req.url.startsWith("/v1/skills")) {
      
      res.setHeader("content-type", "application/json");
      const u = new URL(req.url, "http://x");
      const parts = u.pathname.split("/").filter(Boolean); // v1 skills [id] [versions] [ver]
      log.push(`skills ${req.method} ${u.pathname}${u.search} beta=${req.headers["anthropic-beta"] || ""}`);
      if (req.method === "GET" && parts.length === 2) return res.end(JSON.stringify({ data: skills, has_more: false, next_page: null }));
      if (req.method === "POST" && parts.length === 2) {
        const name = (/name:\s*([\w-]+)/.exec(body) || [])[1] || "skill";
        const files = [...body.matchAll(/filename="([^"]+)"/g)].map(m => m[1]);
        log.push("skill files " + JSON.stringify(files));
        const skill = { id: "skill_" + Date.now(), type: "skill", display_name: name, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), latest_version_id: "skver_1", source: { type: "custom" } };
        skills.push(skill); return res.end(JSON.stringify(skill));
      }
      if (req.method === "GET" && parts[3] === "versions") return res.end(JSON.stringify({ data: [{ id: "skver_1", type: "skill_version", skill_id: parts[2], name: "x", description: "", created_at: "", directory: "x" }], has_more: false, next_page: null }));
      if (req.method === "DELETE" && parts[3] === "versions") return res.end(JSON.stringify({ id: parts[4], type: "skill_version_deleted" }));
      if (req.method === "DELETE" && parts.length === 3) { skills = skills.filter(k => k.id !== parts[2]); return res.end(JSON.stringify({ id: parts[2], type: "skill_deleted" })); }
      res.statusCode = 404; return res.end("{}");
    }
    if (req.url.startsWith("/v1/messages/count_tokens")) {
      const b = JSON.parse(body);
      const chars = JSON.stringify(b.messages).length + JSON.stringify(b.system || "").length;
      log.push("count " + JSON.stringify({ model: b.model, n: b.messages.length, tools: !!b.tools, first: b.messages[0] && b.messages[0].role }));
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ input_tokens: Math.ceil(chars / 2) }));
    }
    if (req.url.startsWith("/v1/messages/batches")) return batchRoute(req, res, body);
    if (req.url.startsWith("/v1/messages")) {
      const b = JSON.parse(body);
      if (b.compaction) {
        log.push("compact " + JSON.stringify({ beta: req.headers["anthropic-beta"] || "", model: b.model, n: b.messages.length, first: b.messages[0].role, prior: JSON.stringify(b.messages[0].content).includes("\"compaction\"") }));
        res.setHeader("content-type", "application/json");
        return res.end(JSON.stringify({ id: "msg_c", type: "message", role: "assistant", model: b.model, content: [{ type: "compaction", content: "## 要約\n- 前半で長い資料を共有した", encrypted_content: null }], stop_reason: "compaction", stop_sequence: null, usage: { input_tokens: 30000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }));
      }
      if (b.stream && JSON.stringify(b.messages[0].content).includes("<conversation_summary>")) log.push("text-summary " + JSON.stringify({ model: b.model, n: b.messages.length }));
      if (!b.stream && JSON.stringify(b.system || "").includes("記録係")) log.push("summarize " + JSON.stringify({ model: b.model }));
      if (b.stream && Array.isArray(b.messages[0].content) && b.messages[0].content[0] && b.messages[0].content[0].type === "compaction") log.push("summary-sent " + JSON.stringify({ beta: req.headers["anthropic-beta"] || "", role: b.messages[0].role, n: b.messages.length }));
      log.push("params " + JSON.stringify({ system: b.system, model: b.model, max_tokens: b.max_tokens, thinking: b.thinking, output_config: b.output_config, stream: b.stream, n: b.messages.length }));
      if (!b.stream) {
        const sys = typeof b.system === "string" ? b.system : JSON.stringify(b.system || "");
        const text = sys.includes("書き方") ? "- 結論を一文目に書く\n- 体言止めを多用する" : sys.includes("引き継ぎ") ? "## 目的\n第3四半期の論点を表で整理する\n## これまでに決まったこと・前提\n売上 +12%、CAC +18%\n## 現在の状態\n表とコード例を提示済み\n## 未解決の点・次にやること\nCAC 悪化の要因分析\n上記を踏まえて続きを手伝ってください。" : body.includes("EV market") ? "EV market trends" : body.includes("React counter") ? "React counter" : body.includes("local tool") ? "Local tool check" : body.includes("Q3 issues") ? "Q3 issues" : body.includes("EV") ? "EV 市場の動向" : body.includes("React") ? "React のカウンター" : body.includes("ローカル") ? "ローカルツールの確認" : "四半期の論点";
        res.setHeader("content-type", "application/json");
        return res.end(JSON.stringify({ id: "msg_s", type: "message", role: "assistant", model: b.model, content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 2100, output_tokens: 180, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }));
      }
      const lastText = JSON.stringify(b.messages[b.messages.length - 1].content);
      const EN = !/[\u3040-\u30ff\u4e00-\u9fff]/.test(lastText);
      if (b.container) log.push("container " + JSON.stringify(b.container) + " tools " + JSON.stringify((b.tools || []).map(t => t.name)));
      const lastMsg = b.messages[b.messages.length - 1];
      const toolResult = Array.isArray(lastMsg.content) && lastMsg.content.find(c => c.type === "tool_result");
      if (b.stream && (b.tools || []).some(t => t.name === "search_project_knowledge")) {
        const docs = JSON.stringify(b.messages).match(/"type":"document"/g) || [];
        const sysK = typeof b.system === "string" ? b.system : JSON.stringify(b.system || "");
        log.push("rag " + JSON.stringify({ documents: docs.length, note: sysK.includes("search_project_knowledge"), toolResult: !!toolResult }));
        res.writeHead(200, { "content-type": "text/event-stream" });
        const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
        ev("message_start", { message: { id: "msg_k", type: "message", role: "assistant", model: b.model, content: [], stop_reason: null, usage: { input_tokens: 800, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } });
        if (toolResult) {
          const text = typeof toolResult.content === "string" ? toolResult.content : JSON.stringify(toolResult.content);
          const hit = /第12条[^\n]*/.exec(text);
          ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
          ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: "ナレッジより: " + (hit ? hit[0] : "見つからず") } });
          ev("content_block_stop", { index: 0 });
          ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 20 } });
        } else {
          ev("content_block_start", { index: 0, content_block: { type: "tool_use", id: "toolu_k1", name: "search_project_knowledge", input: {} } });
          ev("content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ query: "経費精算 締め日" }) } });
          ev("content_block_stop", { index: 0 });
          ev("message_delta", { delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 20 } });
        }
        ev("message_stop", {}); res.end(); return;
      }
      const sysText = typeof b.system === "string" ? b.system : JSON.stringify(b.system || "");
      if (b.stream && (sysText.includes("リサーチモード") || sysText.includes("Research mode"))) {
        log.push("research " + JSON.stringify({ tools: (b.tools || []).map(t => `${t.name}:${t.max_uses}`) }));
        res.writeHead(200, { "content-type": "text/event-stream" });
        const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
        ev("message_start", { message: { id: "msg_r", type: "message", role: "assistant", model: b.model, content: [], stop_reason: null, usage: { input_tokens: 3000, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: 2 } } } });
        let i = 0;
        for (const q of (EN ? ["EV sales 2026", "EV incentives 2026"] : ["電気自動車 販売台数 2026", "EV 補助金 2026"])) {
          ev("content_block_start", { index: i, content_block: { type: "server_tool_use", id: "srv" + i, name: "web_search", input: {} } });
          ev("content_block_delta", { index: i, delta: { type: "input_json_delta", partial_json: JSON.stringify({ query: q }) } });
          ev("content_block_stop", { index: i }); i++;
          await sleep(700);
          ev("content_block_start", { index: i, content_block: { type: "web_search_tool_result", tool_use_id: "srv" + (i - 1), content: [{ type: "web_search_result", url: "https://example.org/" + i, title: (EN ? "Source " : "資料 ") + i, encrypted_content: "x", page_age: null }] } });
          ev("content_block_stop", { index: i }); i++;
        }
        ev("content_block_start", { index: i, content_block: { type: "server_tool_use", id: "srvf", name: "web_fetch", input: {} } });
        ev("content_block_delta", { index: i, delta: { type: "input_json_delta", partial_json: JSON.stringify({ url: "https://example.org/official" }) } });
        ev("content_block_stop", { index: i }); i++;
        await sleep(700);
        ev("content_block_start", { index: i, content_block: { type: "web_fetch_tool_result", tool_use_id: "srvf", content: { type: "web_fetch_result", url: "https://example.org/official", content: { type: "document", source: { type: "text", media_type: "text/plain", data: "公式資料" }, title: "公式資料" } } } });
        ev("content_block_stop", { index: i }); i++;
        ev("content_block_start", { index: i, content_block: { type: "text", text: "" } });
        ev("content_block_delta", { index: i, delta: { type: "text_delta", text: EN ? "## Conclusion\nEV sales keep growing, with 2026 on track for a new high.\n\n## Details\n- Sales: up year over year in the main markets\n- Incentives: several countries are narrowing them\n\n## Uncertainties\n- Final 2026 figures are not published yet" : "## 結論\n販売台数は増えています。\n\n## 詳細\n- 観点1\n\n## 不確実な点\n- 2026年の確定値は未公表" } });
        ev("content_block_stop", { index: i });
        ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 400 } });
        ev("message_stop", {}); res.end(); return;
      }
      const echoTool = (b.tools || []).find(t => typeof t.name === "string" && t.name.endsWith("__echo"));
      if (b.stream && (lastText.includes("ローカルで") || lastText.includes("local tool") || (toolResult && echoTool))) {
        log.push("local " + JSON.stringify({ tools: (b.tools || []).map(t => t.name || t.type), toolResult: toolResult || null }));
        res.writeHead(200, { "content-type": "text/event-stream" });
        const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
        ev("message_start", { message: { id: "msg_l", type: "message", role: "assistant", model: b.model, content: [], stop_reason: null, usage: { input_tokens: 500, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } });
        if (toolResult) {
          const text = Array.isArray(toolResult.content) ? toolResult.content.map(c => c.text || "").join("") : String(toolResult.content);
          ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
          ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: (EN ? (toolResult.is_error ? "Failed: " : "Result: ") : (toolResult.is_error ? "失敗: " : "結果: ")) + text } });
          ev("content_block_stop", { index: 0 });
          ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 20 } });
        } else {
          ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
          ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: EN ? "I'll use the local tool." : "ローカルのツールを使います。" } });
          ev("content_block_stop", { index: 0 });
          ev("content_block_start", { index: 1, content_block: { type: "tool_use", id: "toolu_local1", name: echoTool ? echoTool.name : "missing", input: {} } });
          ev("content_block_delta", { index: 1, delta: { type: "input_json_delta", partial_json: JSON.stringify({ text: EN ? "Hello" : "こんにちは" }) } });
          ev("content_block_stop", { index: 1 });
          ev("message_delta", { delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 30 } });
        }
        ev("message_stop", {}); res.end(); return;
      }
      if (b.stream && lastText.includes("wikiで")) {
        log.push("mcp " + JSON.stringify({ beta: req.headers["anthropic-beta"], servers: b.mcp_servers, tools: (b.tools || []).map(t => t.type + ":" + (t.mcp_server_name || t.name)) }));
        const server = (b.mcp_servers || [])[0]?.name || "none";
        res.writeHead(200, { "content-type": "text/event-stream" });
        const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
        ev("message_start", { message: { id: "msg_m", type: "message", role: "assistant", model: b.model, content: [], stop_reason: null, usage: { input_tokens: 800, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } });
        ev("content_block_start", { index: 0, content_block: { type: "mcp_tool_use", id: "mcptoolu_1", name: "search_wiki", server_name: server, input: { query: "経費精算" } } });
        ev("content_block_stop", { index: 0 });
        ev("content_block_start", { index: 1, content_block: { type: "mcp_tool_result", tool_use_id: "mcptoolu_1", is_error: false, content: [{ type: "text", text: "経費精算は月末締め" }] } });
        ev("content_block_stop", { index: 1 });
        ev("content_block_start", { index: 2, content_block: { type: "text", text: "" } });
        ev("content_block_delta", { index: 2, delta: { type: "text_delta", text: "Wiki によると、経費精算は月末締めです。" } });
        ev("content_block_stop", { index: 2 });
        ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 40 } });
        ev("message_stop", {}); res.end(); return;
      }
      if (b.stream && lastText.includes("前に話した")) {
        log.push("tools " + JSON.stringify((b.tools || []).map(t => t.name)));
        res.writeHead(200, { "content-type": "text/event-stream" });
        const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
        ev("message_start", { message: { id: "msg_t", type: "message", role: "assistant", model: b.model, content: [], stop_reason: null, usage: { input_tokens: 900, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } });
        ev("content_block_start", { index: 0, content_block: { type: "tool_use", id: "toolu_1", name: "search_past_chats", input: {} } });
        ev("content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ query: "四半期" }) } });
        ev("content_block_stop", { index: 0 });
        ev("message_delta", { delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 30 } });
        ev("message_stop", {}); res.end(); return;
      }
      if (b.stream && toolResult) {
        log.push("toolresult " + JSON.stringify(toolResult.content).slice(0, 300));
        res.writeHead(200, { "content-type": "text/event-stream" });
        const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
        ev("message_start", { message: { id: "msg_u", type: "message", role: "assistant", model: b.model, content: [], stop_reason: null, usage: { input_tokens: 1200, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } });
        ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
        ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: "以前の会話では売上が +12% でした。" } });
        ev("content_block_stop", { index: 0 });
        ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 20 } });
        ev("message_stop", {}); res.end(); return;
      }
      const variant = lastText.includes("図を") ? "diagram" : lastText.includes("ページ版") ? "page" : lastText.includes("続きだけ") ? "cont" : lastText.includes("長文") ? "cut" : lastText.includes("数式") ? "math" : lastText.includes("拒否") ? "refuse" : (lastText.includes("Reactで") || lastText.includes("React counter")) ? "react" : null;
      const slow = JSON.stringify(b.messages[b.messages.length - 1].content).includes("ゆっくり");
      res.writeHead(200, { "content-type": "text/event-stream" });
      const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      ev("message_start", { message: { id: "msg_1", type: "message", role: "assistant", model: b.model, content: [], stop_reason: null, usage: { input_tokens: 12340, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } });
      let i = 0;
      if (b.thinking) {
        ev("content_block_start", { index: i, content_block: { type: "thinking", thinking: "", signature: "" } });
        for (const t of ["質問の意図を整理し、", "表とコード例で答える方針にする。"]) { ev("content_block_delta", { index: i, delta: { type: "thinking_delta", thinking: t } }); await sleep(150); }
        ev("content_block_delta", { index: i, delta: { type: "signature_delta", signature: "sig" } });
        ev("content_block_stop", { index: i }); i++;
      }
      ev("content_block_start", { index: i, content_block: { type: "text", text: "" } });
      const doc = "```markdown\n# 議事録\n\n" + Array.from({ length: 12 }, (_, i) => `- 決定事項 ${i + 1}`).join("\n") + "\n```";
      const page = (n) => "```html\n<!doctype html><html><head><title>売上ダッシュボード</title></head><body><h1>版" + n + "</h1></body></html>\n```";
      const versionNo = (JSON.stringify(b.messages).match(/ページ版/g) || []).length;
const reactSrc = "```jsx\nimport { useState } from \"react\";\nimport { Heart } from \"lucide-react\";\nimport { BarChart, Bar, XAxis } from \"recharts\";\n\nexport default function Counter() {\n  const [n, setN] = useState(0);\n  const data = [{ m: \"1月\", v: 3 }, { m: \"2月\", v: 5 }, { m: \"3月\", v: 2 }];\n  return (\n    <div className=\"p-6 font-sans\">\n      <h1 className=\"text-2xl font-bold text-blue-600\">カウンター {n}</h1>\n      <button id=\"inc\" className=\"mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-white\" onClick={() => setN(n + 1)}><Heart size={16} /> 増やす</button>\n      <BarChart width={300} height={160} data={data}><XAxis dataKey=\"m\" /><Bar dataKey=\"v\" fill=\"#578DD9\" /></BarChart>\n    </div>\n  );\n}\n```";
      const body2 = variant === "diagram" ? "フローです。\n\n```mermaid\nflowchart LR\n  申請 --> 承認 --> 完了\n```\n\n" + doc : variant === "page" ? "作りました。\n\n" + page(versionNo) : variant === "cut" ? "長い説明の前半です。ここで出力が" : variant === "cont" ? "途切れた後の続きです。おわり。" : variant === "math" ? "円の面積は \\(\\pi r^2\\) です。\n\n\\[ E = mc^2 \\]\n\nまた $$a^2+b^2=c^2$$ も成り立ちます。料金は $10 と $200 です。" : variant === "refuse" ? "" : variant === "react" ? (EN ? "Here you go.\n\n" + reactSrc.replace("カウンター", "Count").replace("増やす", "Add one").replace(/(\d)月/g, (m, d) => ["Jan", "Feb", "Mar"][d - 1]) : "作りました。\n\n" + reactSrc) : EN ? replyEn : reply;
      const chunks = body2 ? body2.match(/[\s\S]{1,12}/g) : [];
      for (const c of chunks) { if (res.destroyed) break; ev("content_block_delta", { index: i, delta: { type: "text_delta", text: c } }); await sleep(slow ? 250 : 25); }
      ev("content_block_stop", { index: i });
      ev("message_delta", { delta: { stop_reason: variant === "cut" ? "max_tokens" : variant === "refuse" ? "refusal" : "end_turn", stop_sequence: null }, usage: { output_tokens: 1024 } });
      ev("message_stop", {}); res.end(); return;
    }
    res.statusCode = 404; res.end("{}");
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
