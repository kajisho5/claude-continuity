import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { mainT } from "./i18n";
import { splitArgs } from "../src/lib/connectors";

export { joinArgs, splitArgs } from "../src/lib/connectors";

/**
 * Local (stdio) MCP servers, run on this PC like Claude Desktop's "mcpServers".
 * The API's MCP connector only reaches public HTTPS servers, so these are driven from the main process:
 * their tools are offered to Claude as client tools and each call is executed here after the user approves it.
 */
export type LocalServer = { id: string; name: string; command: string; args: string[]; env: Record<string, string> };
export type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> };
/** One API tool: which server and MCP tool it stands for. */
export type LocalToolRef = { serverId: string; serverName: string; tool: string };

const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** KEY=VALUE per line; blank lines and # comments are ignored. */
export function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    const key = (eq < 0 ? line : line.slice(0, eq)).trim();
    if (!ENV_KEY.test(key)) throw new Error(mainT().localMcp.badEnv(key.slice(0, 40)));
    env[key] = eq < 0 ? "" : line.slice(eq + 1);
  }
  return env;
}

export function validateLocal(input: { name?: unknown; command?: unknown; args?: unknown }): { name: string; command: string; args: string[] } {
  const name = String(input.name ?? "").trim().slice(0, 60);
  if (!name) throw new Error(mainT().connectors.nameRequired);
  const command = String(input.command ?? "").trim().slice(0, 1000);
  if (!command) throw new Error(mainT().localMcp.commandRequired);
  const args = Array.isArray(input.args) ? input.args.map(a => String(a).slice(0, 2000)).slice(0, 100) : splitArgs(String(input.args ?? "")).slice(0, 100);
  return { name, command, args };
}

/** Entries of a Claude Desktop config ({ mcpServers: { name: { command, args, env } } }); URL-only entries are skipped. */
export function parseDesktopConfig(json: unknown): { name: string; command: string; args: string[]; env: Record<string, string> }[] {
  const servers = (json as any)?.mcpServers;
  if (!servers || typeof servers !== "object") return [];
  const out = [];
  for (const [name, raw] of Object.entries(servers as Record<string, any>)) {
    if (!raw || typeof raw.command !== "string" || !raw.command.trim()) continue;
    const env: Record<string, string> = {};
    if (raw.env && typeof raw.env === "object") for (const [k, v] of Object.entries(raw.env)) if (ENV_KEY.test(k)) env[k] = String(v ?? "");
    out.push({ name: name.slice(0, 60), command: raw.command.trim(), args: Array.isArray(raw.args) ? raw.args.map((a: unknown) => String(a)) : [], env });
  }
  return out.slice(0, 30);
}

/** Where Claude Desktop keeps its config (https://modelcontextprotocol.io/docs/develop/connect-local-servers). */
export function desktopConfigPath(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string): string {
  if (platform === "win32") return path.win32.join(env.APPDATA || path.win32.join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  if (platform === "darwin") return path.posix.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  return path.posix.join(env.XDG_CONFIG_HOME || path.posix.join(home, ".config"), "Claude", "claude_desktop_config.json");
}

/** API tool names must match ^[a-zA-Z0-9_-]{1,128}$; prefix with the server so tools of different servers never collide. */
export function apiToolName(serverName: string, serverId: string, tool: string, taken: Set<string>): string {
  const clean = (s: string) => s.normalize("NFKC").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  const prefix = (clean(serverName).slice(0, 24) || "local") + "_" + serverId.slice(0, 4);
  let name = `${prefix}__${clean(tool) || "tool"}`.slice(0, 128);
  for (let i = 2; taken.has(name); i++) name = `${prefix}__${clean(tool).slice(0, 100)}_${i}`.slice(0, 128);
  taken.add(name);
  return name;
}

/** Tool definitions for the request, plus the map back from API names to servers and MCP tool names. */
export function toolDefinitions(servers: { server: LocalServer; tools: McpTool[] }[], limit = 100): { tools: object[]; refs: Map<string, LocalToolRef> } {
  const taken = new Set<string>();
  const refs = new Map<string, LocalToolRef>();
  const tools: object[] = [];
  for (const { server, tools: list } of servers) {
    for (const tool of list) {
      if (tools.length >= limit) break;
      const name = apiToolName(server.name, server.id, tool.name, taken);
      refs.set(name, { serverId: server.id, serverName: server.name, tool: tool.name });
      const schema = tool.inputSchema && typeof tool.inputSchema === "object" ? tool.inputSchema : {};
      tools.push({ name, description: `[${server.name}] ${tool.description ?? tool.name}`.slice(0, 4000), input_schema: { ...schema, type: "object" } });
    }
  }
  return { tools, refs };
}

const MAX_RESULT_CHARS = 100_000;
/** MCP tool result → tool_result content (text and images); other content types are passed on as JSON text. */
export function toToolResult(result: any): { content: any[]; text: string; isError: boolean } {
  const content: any[] = [];
  const texts: string[] = [];
  let budget = MAX_RESULT_CHARS;
  const pushText = (s: string) => {
    // The API rejects empty text blocks; "success, no output" falls through to emptyResult below.
    if (!s || budget <= 0) return;
    const clipped = s.length > budget ? s.slice(0, budget) + mainT().localMcp.truncated : s;
    budget -= clipped.length;
    content.push({ type: "text", text: clipped }); texts.push(clipped);
  };
  for (const item of Array.isArray(result?.content) ? result.content : []) {
    if (item?.type === "text") pushText(String(item.text ?? ""));
    else if (item?.type === "image" && typeof item.data === "string" && /^image\/(png|jpeg|gif|webp)$/.test(item.mimeType)) {
      content.push({ type: "image", source: { type: "base64", media_type: item.mimeType, data: item.data } }); texts.push(`[image ${item.mimeType}]`);
    } else if (item?.type === "resource" && typeof item.resource?.text === "string") pushText(item.resource.text);
    else if (item) pushText(JSON.stringify(item));
  }
  if (!content.length && result?.structuredContent) pushText(JSON.stringify(result.structuredContent));
  if (!content.length) pushText(mainT().localMcp.emptyResult);
  return { content, text: texts.join("\n"), isError: result?.isError === true };
}

type Live = { key: string; client: any; transport: any; tools?: McpTool[]; stderr: string };

/** Keeps one running process per server; restarted when its settings change or it exits. */
export class LocalMcpPool {
  private live = new Map<string, Live>();
  // Starts in progress, so two callers (a reply and the Test button) share one process instead of spawning two.
  private starting = new Map<string, { key: string; promise: Promise<Live> }>();
  constructor(private clientInfo: { name: string; version: string }) {}

  private connect(server: LocalServer): Promise<Live> {
    const key = JSON.stringify([server.command, server.args, server.env]);
    const inFlight = this.starting.get(server.id);
    if (inFlight && inFlight.key === key) return inFlight.promise;
    const promise = (inFlight ? inFlight.promise.catch(() => undefined) : Promise.resolve()).then(() => this.start(server, key));
    this.starting.set(server.id, { key, promise });
    const clear = () => { if (this.starting.get(server.id)?.promise === promise) this.starting.delete(server.id); };
    promise.then(clear, clear);
    return promise;
  }

  private async start(server: LocalServer, key: string): Promise<Live> {
    const current = this.live.get(server.id);
    if (current && current.key === key) return current;
    if (current) await this.close(server.id);
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { StdioClientTransport, getDefaultEnvironment } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const base = getDefaultEnvironment();
    // Apps started from the macOS Dock do not get the shell's PATH; add the usual Homebrew locations.
    if (process.platform === "darwin") base.PATH = macPath(base.PATH);
    const transport = new StdioClientTransport({ command: server.command, args: server.args, env: { ...base, ...server.env }, stderr: "pipe" });
    const entry: Live = { key, client: new Client(this.clientInfo), transport, stderr: "" };
    transport.stderr?.on("data", (chunk: Buffer) => { entry.stderr = (entry.stderr + chunk.toString("utf8")).slice(-2000); });
    transport.onclose = () => { if (this.live.get(server.id) === entry) this.live.delete(server.id); };
    try {
      await withTimeout(entry.client.connect(transport), 60_000, mainT().localMcp.startTimeout);
    } catch (error) {
      await entry.client.close().catch(() => {});
      throw new Error(mainT().localMcp.startFailed(server.name, describe(error), entry.stderr.trim().slice(-600)));
    }
    this.live.set(server.id, entry);
    return entry;
  }

  async tools(server: LocalServer): Promise<McpTool[]> {
    const entry = await this.connect(server);
    if (!entry.tools) {
      const { tools } = await entry.client.listTools();
      entry.tools = (tools as McpTool[]).slice(0, 100);
    }
    return entry.tools;
  }

  async call(server: LocalServer, tool: string, args: unknown, signal?: AbortSignal) {
    const entry = await this.connect(server);
    return entry.client.callTool({ name: tool, arguments: (args && typeof args === "object" ? args : {}) as Record<string, unknown> }, undefined, { signal, timeout: 300_000 });
  }

  async close(id: string) {
    // A server still starting is waited for, so it is not left running once it finishes starting.
    await this.starting.get(id)?.promise.catch(() => undefined);
    const entry = this.live.get(id);
    this.live.delete(id);
    await entry?.client.close().catch(() => {});
  }
  async closeAll() {
    // Servers still starting are waited for (they end up in live) so they are shut down too.
    await Promise.all([...this.starting.values()].map(s => s.promise.catch(() => undefined)));
    await Promise.all([...this.live.keys()].map(id => this.close(id)));
  }
}

/**
 * Apps started from the Dock get launchd's short PATH; commands installed by Homebrew, uv, cargo, volta, bun or a
 * Node version manager are found through the user's login shell PATH (read once) plus the usual folders.
 */
let loginShellPath: string | null | undefined;
function readLoginShellPath(): string | null {
  if (loginShellPath !== undefined) return loginShellPath;
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    const out = execFileSync(shell, ["-ilc", "printf '%s' \"$PATH\""], { timeout: 3000, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    loginShellPath = out.split("\n").pop()?.trim() || null;
  } catch { loginShellPath = null; }
  return loginShellPath;
}
function macPath(current: string | undefined): string {
  const home = os.homedir();
  const extra = ["/opt/homebrew/bin", "/usr/local/bin", `${home}/.local/bin`, `${home}/.cargo/bin`, `${home}/.volta/bin`, `${home}/.bun/bin`];
  const parts = [...(current ?? "").split(":"), ...(readLoginShellPath() ?? "").split(":"), ...extra].filter(Boolean);
  return [...new Set(parts)].join(":");
}

const describe = (error: unknown) => String((error as Error)?.message ?? error).slice(0, 300);
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}
