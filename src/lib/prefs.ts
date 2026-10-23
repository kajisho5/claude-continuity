import type { LanguagePref } from "../i18n";

/** Global shortcut that brings the app forward with a new chat ("" = off). Mirrors electron/main.ts. */
export type QuickShortcut = "" | "CommandOrControl+Alt+Space" | "CommandOrControl+Shift+Space" | "Alt+Space";
export const QUICK_SHORTCUTS: QuickShortcut[] = ["CommandOrControl+Alt+Space", "CommandOrControl+Shift+Space", "Alt+Space", ""];
export type CustomStyle = { id: string; name: string; prompt: string };
export type Prefs = { autoTitle: boolean; customStyle: string; customStyles: CustomStyle[]; displayName: string; theme: "system" | "light" | "dark"; chatFont: "serif" | "sans" | "system"; shareName: boolean; preferences: string; searchPastChats: boolean; notifyOnReply: boolean; checkUpdates: boolean; language: LanguagePref; quickShortcut: QuickShortcut; enabledSkills: string[]; lastModel: string; lastEffort: string };
export const DEFAULT_PREFS: Prefs = { autoTitle: true, customStyle: "", customStyles: [], displayName: "", theme: "dark", chatFont: "serif", shareName: false, preferences: "", searchPastChats: true, notifyOnReply: true, checkUpdates: true, language: "system", quickShortcut: "CommandOrControl+Alt+Space", enabledSkills: [], lastModel: "", lastEffort: "" };
