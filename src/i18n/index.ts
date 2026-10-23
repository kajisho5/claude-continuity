import { useSyncExternalStore } from "react";
import { ja } from "./ja";
import { en } from "./en";

/** UI strings live in `ja/<namespace>.ts`; `en/<namespace>.ts` is typed against it, so a missing English string fails the type check. */
export type Messages = typeof ja;
export type Locale = "ja" | "en";
export type LanguagePref = "system" | Locale;
export const LOCALES: Locale[] = ["ja", "en"];
const DICTS: Record<Locale, Messages> = { ja, en };

/** "system" follows the OS / browser language: Japanese for ja-*, English otherwise. */
export function resolveLocale(pref: LanguagePref, systemLanguage = typeof navigator !== "undefined" ? navigator.language : ""): Locale {
  if (pref !== "system") return pref;
  return /^ja\b/i.test(systemLanguage) ? "ja" : "en";
}

// Japanese until told otherwise (the app was Japanese-only, and the unit tests expect it).
let current: Locale = "ja";
const listeners = new Set<() => void>();

export function setLocale(locale: Locale): void {
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  if (locale === current) return;
  current = locale;
  listeners.forEach(listener => listener());
}
export const getLocale = (): Locale => current;
/** BCP 47 tag for Intl / toLocale*String. */
export const intlLocale = (locale: Locale = current): string => locale === "ja" ? "ja-JP" : "en-US";

/** Current strings, for code outside React components (helpers called while rendering). */
export const t = (): Messages => DICTS[current];

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
/** Current strings in a component; re-renders it when the language changes. */
export function useT(): Messages {
  return DICTS[useSyncExternalStore(subscribe, getLocale, getLocale)];
}
