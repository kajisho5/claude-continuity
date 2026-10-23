/** Mirrors electron/updater.ts UpdateStatus. */
export type UpdateStatus =
  | { state: "idle" | "checking" | "none" }
  | { state: "available" | "ready"; version: string; notes?: string }
  | { state: "downloading"; version: string; percent: number }
  | { state: "error"; message: string };
