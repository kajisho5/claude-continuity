import { ja } from "./locales/ja";
import { en } from "./locales/en";

/** Strings for the main process (dialogs, notifications, errors returned to the renderer, prompts sent to Claude). */
export type MainMessages = typeof ja;
export type MainLocale = "ja" | "en";
export type LanguagePref = "system" | MainLocale;
const DICTS: Record<MainLocale, MainMessages> = { ja, en };

/** "system" follows the OS language (app.getLocale()): Japanese for ja-*, English otherwise. */
export function resolveMainLocale(pref: LanguagePref | undefined, systemLocale: string): MainLocale {
  if (pref === "ja" || pref === "en") return pref;
  return /^ja\b/i.test(systemLocale) ? "ja" : "en";
}

// Japanese until main.ts reads the preference (the app was Japanese-only, and the unit tests expect it).
let current: MainLocale = "ja";
export function setMainLocale(locale: MainLocale): void { current = locale; }
export const getMainLocale = (): MainLocale => current;
/** BCP 47 tag for Intl / toLocale*String. */
export const mainIntlLocale = (locale: MainLocale = current): string => locale === "ja" ? "ja-JP" : "en-US";
/** Current strings. */
export const mainT = (): MainMessages => DICTS[current];
