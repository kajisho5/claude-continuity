export type Prefs = { autoTitle: boolean; customStyle: string; displayName: string; theme: "system" | "light" | "dark"; chatFont: "serif" | "sans" | "system"; shareName: boolean; preferences: string };
export const DEFAULT_PREFS: Prefs = { autoTitle: true, customStyle: "", displayName: "", theme: "dark", chatFont: "serif", shareName: false, preferences: "" };
