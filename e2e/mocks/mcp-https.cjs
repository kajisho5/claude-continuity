// Remote MCP server over HTTPS (Streamable HTTP) for the connectors flow.
// Requires `Authorization: Bearer secret-token`. The self-signed certificate is generated at
// runtime with openssl into a temp folder, so no key material is committed.
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");

function makeCert(dir) {
  const key = path.join(dir, "key.pem"), cert = path.join(dir, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2", "-subj", "/CN=127.0.0.1",
    "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost", "-keyout", key, "-out", cert], { stdio: "ignore" });
  return { key, cert };
}

/** Starts the server; resolves to { certPath, log, close }. Pass certPath to the app as NODE_EXTRA_CA_CERTS. */
function start({ port = 8443, dir }) {
  const { key, cert } = makeCert(dir);
  const log = [];
  const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, async (req, res) => {
    log.push(`${req.method} ${req.url}`);
    if (req.headers.authorization !== "Bearer secret-token") { res.writeHead(401); res.end("unauthorized"); return; }
    const mcp = new McpServer({ name: "test-wiki", version: "1.0.0" });
    mcp.tool("search_wiki", "Search the wiki", { query: z.string() }, async ({ query }) => ({ content: [{ type: "text", text: `wiki result for ${query}` }] }));
    mcp.tool("get_page", "Get a page", { id: z.string() }, async ({ id }) => ({ content: [{ type: "text", text: `page ${id}` }] }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close(); mcp.close(); });
    await mcp.connect(transport);
    let body = ""; req.on("data", c => body += c); req.on("end", () => transport.handleRequest(req, res, body ? JSON.parse(body) : undefined));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ certPath: cert, log, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); }) }));
  });
}
module.exports = { start };
