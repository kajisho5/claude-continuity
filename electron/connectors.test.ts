import { describe, expect, it } from "vitest";
import { connectorRequest, serverName, validateConnector } from "./connectors";

describe("connectors", () => {
  it("validates https URLs and names", () => {
    expect(validateConnector({ name: " Notion ", url: "https://mcp.example.com/mcp" })).toEqual({ name: "Notion", url: "https://mcp.example.com/mcp" });
    expect(() => validateConnector({ name: "x", url: "http://mcp.example.com" })).toThrow("https://");
    expect(() => validateConnector({ name: "x", url: "https://u:p@mcp.example.com" })).toThrow("認証情報");
    expect(() => validateConnector({ name: "", url: "https://a.example" })).toThrow("名前");
    expect(() => validateConnector({ name: "x", url: "not a url" })).toThrow("形式");
  });
  it("derives unique ASCII server names", () => {
    expect(serverName({ id: "abc123def", name: "Google カレンダー" })).toBe("google-abc123");
    expect(serverName({ id: "zzz999", name: "日本語" })).toBe("connector-zzz999");
  });
  it("builds mcp_servers and toolsets, adding the token only when present", () => {
    const req = connectorRequest([{ id: "a1b2c3", name: "Docs", url: "https://d.example/mcp", enabled: true, token: "t" }, { id: "x9y8z7", name: "Wiki", url: "https://w.example/sse", enabled: true }]);
    expect(req.mcp_servers).toEqual([
      { type: "url", url: "https://d.example/mcp", name: "docs-a1b2c3", authorization_token: "t" },
      { type: "url", url: "https://w.example/sse", name: "wiki-x9y8z7" }
    ]);
    expect(req.tools).toEqual([{ type: "mcp_toolset", mcp_server_name: "docs-a1b2c3" }, { type: "mcp_toolset", mcp_server_name: "wiki-x9y8z7" }]);
  });
});
