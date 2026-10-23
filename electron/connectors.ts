import { mainT } from "./i18n";

/**
 * MCP servers Claude can use. "remote" ones are called by the API through the MCP connector (beta);
 * "local" ones are stdio servers started on this PC (see localMcp.ts).
 */
export type Connector = {
  id: string; name: string; enabled: boolean; transport: "remote" | "local";
  url: string; token?: string;
  command?: string; args?: string[]; env?: Record<string, string>;
  /** Local tools the user chose "always allow" for. */
  allowedTools?: string[];
};
export type ConnectorView = {
  id: string; name: string; enabled: boolean; transport: "remote" | "local";
  url: string; hasToken: boolean;
  command?: string; args?: string[]; envKeys?: string[]; allowedTools?: string[];
};
export const MCP_CONNECTOR_BETA = "mcp-client-2025-11-20";

/** Server names must be unique identifiers; derive one from the display name. */
export function serverName(connector: Pick<Connector, "id" | "name">): string {
  const base = connector.name.normalize("NFKC").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `${base || "connector"}-${connector.id.slice(0, 6)}`;
}

export function validateConnector(input: { name?: unknown; url?: unknown }): { name: string; url: string } {
  const name = String(input.name ?? "").trim().slice(0, 60);
  const url = String(input.url ?? "").trim();
  if (!name) throw new Error(mainT().connectors.nameRequired);
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error(mainT().connectors.badUrl); }
  // The API only reaches publicly exposed HTTPS servers; local stdio servers cannot be used this way.
  if (parsed.protocol !== "https:") throw new Error(mainT().connectors.httpsOnly);
  if (parsed.username || parsed.password) throw new Error(mainT().connectors.noCredentialsInUrl);
  return { name, url: parsed.toString() };
}

/** Request pieces for the active connectors: mcp_servers plus one mcp_toolset per server. */
export function connectorRequest(connectors: Pick<Connector, "id" | "name" | "url" | "token">[]): { mcp_servers: object[]; tools: object[] } {
  const mcp_servers = connectors.map(c => ({ type: "url", url: c.url, name: serverName(c), ...(c.token ? { authorization_token: c.token } : {}) }));
  const tools = connectors.map(c => ({ type: "mcp_toolset", mcp_server_name: serverName(c) }));
  return { mcp_servers, tools };
}
