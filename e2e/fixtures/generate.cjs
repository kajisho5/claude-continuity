// Fixtures that are large or contain absolute paths are generated per run instead of committed.
const fs = require("node:fs");
const path = require("node:path");

const FIXTURES = __dirname;
const PARA = "この段落は一般的な社内情報です。" + "会議の議事録と予定の共有。".repeat(20);
const RULE = "第12条 経費精算は月末締めで、翌月10日に振り込みます。領収書の原本を添付してください。";

/** Two ~160k-character handbooks (too big to inline); only the first holds the article the flow asks about. */
function makeHandbooks(dir) {
  const paras = n => Array.from({ length: n }, () => PARA);
  const one = paras(600); one.splice(300, 0, RULE);
  const files = [path.join(dir, "handbook-1.txt"), path.join(dir, "handbook-2.txt")];
  fs.writeFileSync(files[0], one.join("\n\n"));
  fs.writeFileSync(files[1], paras(600).join("\n\n"));
  return files;
}

/** An XDG_CONFIG_HOME holding a Claude Desktop config with one local (stdio) server and one remote-only entry. */
function makeDesktopConfig(dir) {
  const cfgDir = path.join(dir, "xdg-config");
  fs.mkdirSync(path.join(cfgDir, "Claude"), { recursive: true });
  const config = { mcpServers: {
    "echo-test": { command: "node", args: [localMcpServer()], env: { ECHO_PREFIX: "secret-prefix" } },
    "remote-only": { url: "https://example.com/mcp" }
  } };
  fs.writeFileSync(path.join(cfgDir, "Claude", "claude_desktop_config.json"), JSON.stringify(config, null, 2));
  return cfgDir;
}

const localMcpServer = () => path.join(FIXTURES, "local-mcp", "server.mjs");
const skillDir = () => path.join(FIXTURES, "skills", "weekly-report");

module.exports = { makeHandbooks, makeDesktopConfig, localMcpServer, skillDir, RULE };
