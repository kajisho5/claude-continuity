import { afterEach, describe, expect, it } from "vitest";
import { getMainLocale, mainT, resolveMainLocale, setMainLocale } from "./i18n";
import { buildSystem, buildTools } from "./request";
import { formatHits } from "./pastChats";
import { validateConnector } from "./connectors";

afterEach(() => setMainLocale("ja"));

describe("main-process locale", () => {
  it("resolves the preference, following the OS for system", () => {
    expect(resolveMainLocale("en", "ja-JP")).toBe("en");
    expect(resolveMainLocale("ja", "en-US")).toBe("ja");
    expect(resolveMainLocale("system", "ja")).toBe("ja");
    expect(resolveMainLocale("system", "en-GB")).toBe("en");
    expect(resolveMainLocale(undefined, "fr")).toBe("en");
  });
  it("defaults to Japanese", () => {
    expect(getMainLocale()).toBe("ja");
    expect(mainT().main.customStyleName).toBe("カスタム");
  });
  it("builds the system prompt in English", () => {
    setMainLocale("en");
    const system = buildSystem("concise", "", { id: "p", name: "Q3", instructions: "Use USD", knowledge: [], memory: false }, { name: "Shota", preferences: "Be brief" });
    expect(system).toBe("# About the user\nWhat to call the user: Shota\nWhat the user wants considered in every conversation:\nBe brief\n\n" +
      `${mainT().request.stylePrompts.concise}\n\n# Instructions for the project "Q3"\nUse USD`);
  });
  it("switches tool descriptions, notices and errors to English", () => {
    setMainLocale("en");
    const { tools, unavailable } = buildTools({ webSearch: true, pastChats: true }, { webSearch: false, codeExecution: false, imageInput: true, pdfInput: true });
    expect(unavailable).toEqual(["Web search"]);
    expect((tools[0] as { description: string }).description).toMatch(/^Searches the user's past conversations/);
    expect(formatHits([])).toBe("No matching past conversations were found.");
    expect(formatHits([{ id: "a", title: "Q3 review", updatedAt: "2026-10-01T00:00:00Z", score: 1, excerpt: "…" }])).toBe('1. "Q3 review" (2026-10-01)\n…');
    expect(() => validateConnector({ name: "", url: "https://x" })).toThrow("Name is required.");
  });
});
