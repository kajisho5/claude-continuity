import { describe, expect, it } from "vitest";
import { editUserMessage, selectUserVersion } from "./versions";
import type { Msg } from "../components/MessageItem";

const thread: Msg[] = [
  { role: "user", content: "A" }, { role: "assistant", content: "a" },
  { role: "user", content: "B" }, { role: "assistant", content: "b" }
];

describe("user message versions", () => {
  it("edit keeps the old wording and its replies", () => {
    const edited = editUserMessage(thread, 2, "B2");
    expect(edited).toHaveLength(3);
    expect(edited[2]).toMatchObject({ content: "B2", versionIndex: 1 });
    expect(edited[2].versions?.[0]).toEqual({ content: "B", tail: [{ role: "assistant", content: "b" }] });
  });
  it("switching restores each version's replies", () => {
    const edited = [...editUserMessage(thread, 2, "B2"), { role: "assistant" as const, content: "b2" }];
    const back = selectUserVersion(edited, 2, 0);
    expect(back.map(m => m.content)).toEqual(["A", "a", "B", "b"]);
    const forward = selectUserVersion(back, 2, 1);
    expect(forward.map(m => m.content)).toEqual(["A", "a", "B2", "b2"]);
  });
  it("editing again adds a third version and preserves the second's replies", () => {
    const edited = [...editUserMessage(thread, 2, "B2"), { role: "assistant" as const, content: "b2" }];
    const third = editUserMessage(edited, 2, "B3");
    expect(third[2].versions?.map(v => v.content)).toEqual(["B", "B2", "B3"]);
    expect(third[2].versions?.[1].tail.map(m => m.content)).toEqual(["b2"]);
    expect(selectUserVersion(third, 2, 9)).toBe(third);
  });
});
