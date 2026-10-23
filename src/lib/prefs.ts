import type { LanguagePref } from "../i18n";

export type CustomStyle = { id: string; name: string; prompt: string };
export type Prefs = { autoTitle: boolean; customStyle: string; customStyles: CustomStyle[]; displayName: string; theme: "system" | "light" | "dark"; chatFont: "serif" | "sans" | "system"; shareName: boolean; preferences: string; searchPastChats: boolean; notifyOnReply: boolean; checkUpdates: boolean; language: LanguagePref };
export const DEFAULT_PREFS: Prefs = { autoTitle: true, customStyle: "", customStyles: [], displayName: "", theme: "dark", chatFont: "serif", shareName: false, preferences: "", searchPastChats: true, notifyOnReply: true, checkUpdates: true, language: "system" };
