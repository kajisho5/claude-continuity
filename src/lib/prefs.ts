import type { LanguagePref } from "../i18n";

/** Global shortcut that brings the app forward with a new chat ("" = off). Mirrors electron/main.ts. */
export type QuickShortcut = "" | "CommandOrControl+Alt+Space" | "CommandOrControl+Shift+Space" | "Alt+Space";
export const QUICK_SHORTCUTS: QuickShortcut[] = ["CommandOrControl+Alt+Space", "CommandOrControl+Shift+Space", "Alt+Space", ""];
export type CustomStyle = { id: string; name: string; prompt: string };
export type Prefs = { autoTitle: boolean; customStyle: string; customStyles: CustomStyle[]; displayName: string; theme: "system" | "light" | "dark"; chatFont: "serif" | "sans" | "system"; shareName: boolean; preferences: string; referencePastChats: boolean; notifyOnReply: boolean; checkUpdates: boolean; language: LanguagePref; quickShortcut: QuickShortcut; enabledSkills: string[]; lastModel: string; lastEffort: string;
  /** Long chats: older turns are summarized instead of dropped. */
  compactLongChats: boolean;
  /** Spending limits checked before sending (null = none) and what happens when a message would pass one. */
  limitPerMessageUsd: number | null; limitDailyUsd: number | null; limitMode: "confirm" | "block";
  /** Start of the credit cycle whose before-expiry suggestions were dismissed. */
  suggestDismissedCycle: string };
export const DEFAULT_PREFS: Prefs = { autoTitle: true, customStyle: "", customStyles: [], displayName: "", theme: "dark", chatFont: "serif", shareName: false, preferences: "", referencePastChats: false, notifyOnReply: true, checkUpdates: true, language: "system", quickShortcut: "CommandOrControl+Alt+Space", enabledSkills: [], lastModel: "", lastEffort: "", compactLongChats: true, limitPerMessageUsd: null, limitDailyUsd: null, limitMode: "confirm", suggestDismissedCycle: "" };
