import { describe, expect, it, vi } from "vitest";
vi.mock("electron", () => ({ app: {}, ipcMain: {}, Notification: class {} }));
vi.mock("electron-updater", () => ({ autoUpdater: {} }));
const { notesText } = await import("./updater");

describe("notesText", () => {
  it("turns GitHub HTML notes into plain text", () => {
    expect(notesText("<h2>変更内容</h2><ul><li>通知を追加</li><li>A &amp; B</li></ul>")).toBe("変更内容\n- 通知を追加\n- A & B");
  });
  it("joins notes from several versions and ignores empty input", () => {
    expect(notesText([{ version: "0.2.0", note: "<p>二つ目</p>" }, { version: "0.1.1", note: "一つ目" }])).toBe("二つ目\n一つ目");
    expect(notesText(null)).toBeUndefined();
    expect(notesText("   ")).toBeUndefined();
  });
});
