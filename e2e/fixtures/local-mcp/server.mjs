// Local MCP echo server over stdio, launched by the app as a "local connector".
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const server = new McpServer({ name: "echo-test", version: "1.0.0" });
server.registerTool("echo", { description: "Echo text back", inputSchema: { text: z.string() } }, async ({ text }) => ({ content: [{ type: "text", text: `ECHO(${process.env.ECHO_PREFIX ?? "-"}): ${text}` }] }));
server.registerTool("add", { description: "Add numbers", inputSchema: { a: z.number(), b: z.number() } }, async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] }));
await server.connect(new StdioServerTransport());
