import { describe, expect, it } from "vitest";
import { apiToolName, desktopConfigPath, joinArgs, parseDesktopConfig, parseEnv, splitArgs, toolDefinitions, toToolResult, validateLocal } from "./localMcp";

describe("splitArgs / joinArgs", () => {
  it("splits on spaces and groups quotes, keeping Windows backslashes", () => {
    expect(splitArgs(`-y @modelcontextprotocol/server-filesystem "C:\\Users\\me\\My Documents" 'a b' ""`)).toEqual(["-y", "@modelcontextprotocol/server-filesystem", "C:\\Users\\me\\My Documents", "a b", ""]);
    expect(splitArgs("   ")).toEqual([]);
  });
  it("round-trips", () => {
    const args = ["-y", "pkg", "C:\\Users\\me\\My Documents", 'say "hi"', ""];
    expect(splitArgs(joinArgs(args))).toEqual(args);
  });
});

describe("parseEnv", () => {
  it("reads KEY=VALUE lines and keeps = inside values", () => {
    expect(parseEnv("# comment\nAPI_KEY=abc=def\n\nEMPTY=\nFLAG")).toEqual({ API_KEY: "abc=def", EMPTY: "", FLAG: "" });
  });
  it("rejects invalid names", () => {
    expect(() => parseEnv("1BAD=x")).toThrow(/1BAD/);
  });
});

describe("validateLocal", () => {
  it("requires a name and a command and accepts args as text or a list", () => {
    expect(validateLocal({ name: " fs ", command: " npx ", args: "-y pkg" })).toEqual({ name: "fs", command: "npx", args: ["-y", "pkg"] });
    expect(validateLocal({ name: "fs", command: "node", args: ["a b"] }).args).toEqual(["a b"]);
    expect(() => validateLocal({ name: "fs", command: "" })).toThrow();
    expect(() => validateLocal({ name: "", command: "npx" })).toThrow();
  });
});

describe("Claude Desktop config", () => {
  it("takes stdio entries and skips URL-only ones", () => {
    const servers = parseDesktopConfig({ mcpServers: {
      filesystem: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/Desktop"] },
      brave: { command: "npx", args: ["-y", "@modelcontextprotocol/server-brave-search"], env: { BRAVE_API_KEY: "k", "bad name": "x" } },
      remote: { url: "https://example.com/mcp" }
    } });
    expect(servers).toEqual([
      { name: "filesystem", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/Desktop"], env: {} },
      { name: "brave", command: "npx", args: ["-y", "@modelcontextprotocol/server-brave-search"], env: { BRAVE_API_KEY: "k" } }
    ]);
    expect(parseDesktopConfig({})).toEqual([]);
  });
  it("uses the documented locations", () => {
    expect(desktopConfigPath("win32", { APPDATA: "C:\\Users\\me\\AppData\\Roaming" }, "C:\\Users\\me")).toBe("C:\\Users\\me\\AppData\\Roaming\\Claude\\claude_desktop_config.json");
    expect(desktopConfigPath("darwin", {}, "/Users/me")).toBe("/Users/me/Library/Application Support/Claude/claude_desktop_config.json");
    expect(desktopConfigPath("linux", {}, "/home/me")).toBe("/home/me/.config/Claude/claude_desktop_config.json");
  });
});

describe("tool definitions", () => {
  it("produces valid, unique API names mapped back to the server", () => {
    const taken = new Set<string>();
    const a = apiToolName("ファイル", "abcdef", "read file", taken);
    const b = apiToolName("ファイル", "abcdef", "read file", taken);
    for (const n of [a, b]) expect(n).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
    expect(a).not.toBe(b);
    const { tools, refs } = toolDefinitions([{ server: { id: "s1xxxx", name: "fs", command: "npx", args: [], env: {} }, tools: [{ name: "read_file", description: "Read", inputSchema: { type: "object", properties: { path: { type: "string" } } } }, { name: "x".repeat(200) }] }]);
    expect(tools).toHaveLength(2);
    expect((tools[0] as any).input_schema.properties.path.type).toBe("string");
    expect((tools[1] as any).input_schema).toEqual({ type: "object" });
    for (const t of tools as any[]) expect(t.name).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
    expect(refs.get((tools[0] as any).name)).toEqual({ serverId: "s1xxxx", serverName: "fs", tool: "read_file" });
  });
});

describe("toToolResult", () => {
  it("passes text and images, JSON for the rest, and keeps the error flag", () => {
    const r = toToolResult({ isError: true, content: [{ type: "text", text: "hi" }, { type: "image", data: "AAA", mimeType: "image/png" }, { type: "resource_link", uri: "file:///x" }] });
    expect(r.isError).toBe(true);
    expect(r.content[0]).toEqual({ type: "text", text: "hi" });
    expect(r.content[1]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "AAA" } });
    expect(r.content[2].text).toContain("resource_link");
    expect(toToolResult({ content: [] }).content).toEqual([{ type: "text", text: "（結果なし）" }]);
    expect(toToolResult({ content: [], structuredContent: { a: 1 } }).text).toBe('{"a":1}');
  });
  it("truncates very long text", () => {
    const r = toToolResult({ content: [{ type: "text", text: "a".repeat(150_000) }] });
    expect(r.text.length).toBeLessThan(101_000);
  });
});
