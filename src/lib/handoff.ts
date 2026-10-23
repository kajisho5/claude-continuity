/**
 * Builds the text handed to the Claude apps through claude://claude.ai/new?q=…
 * The help center states q is truncated to roughly 14,000 characters; Windows also caps a launched
 * command line at 32,767 characters, and the URL is percent-encoded (about 9 characters per Japanese
 * character), so the encoded length is budgeted separately.
 */
import { t as dict } from "../i18n";

export const HANDOFF_MAX_CHARS = 13_000;
export const HANDOFF_MAX_ENCODED_WIN = 30_000;
export const HANDOFF_PREFIX = "claude://claude.ai/new?q=";

type Turn = { role: "user" | "assistant"; content: string };

export function encodedLength(text: string): number {
  return HANDOFF_PREFIX.length + encodeURIComponent(text).length;
}

export function fitsHandoff(text: string, platform: string): boolean {
  if (text.length > HANDOFF_MAX_CHARS) return false;
  return platform !== "win32" || encodedLength(text) <= HANDOFF_MAX_ENCODED_WIN;
}

/** Cuts text at the end so it fits, keeping whole characters (no split surrogate pairs). */
export function clipToFit(text: string, platform: string): { text: string; clipped: boolean } {
  if (fitsHandoff(text, platform)) return { text, clipped: false };
  const chars = Array.from(text);
  let lo = 0, hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fitsHandoff(chars.slice(0, mid).join("") + "…", platform)) lo = mid; else hi = mid - 1;
  }
  return { text: chars.slice(0, lo).join("") + "…", clipped: true };
}

const speaker = (t: Turn) => dict().lib.handoff.speaker(t.role === "user" ? dict().lib.handoff.me : "Claude");

/** Recent turns, newest kept first, within the platform budget. Older turns are dropped with a note. */
export function transcriptHandoff(title: string, turns: Turn[], platform: string): { text: string; included: number; total: number } {
  const usable = turns.filter(t => t.content.trim());
  const s = dict().lib.handoff;
  const head = `${s.intro}\n\n# ${title}\n`;
  const render = (t: Turn) => `\n${speaker(t)}\n${t.content.trim().length > 3000 ? t.content.trim().slice(0, 3000) + s.truncated : t.content.trim()}\n`;
  let body = "";
  let included = 0;
  for (let i = usable.length - 1; i >= 0; i--) {
    const next = render(usable[i]) + body;
    const omitted = i > 0 ? `\n${s.omitted}\n` : "";
    if (!fitsHandoff(head + omitted + next, platform)) break;
    body = next; included++;
  }
  if (included === 0 && usable.length) {
    // Even the latest turn is too long on its own: keep its beginning.
    return { text: clipToFit(head + render(usable[usable.length - 1]), platform).text, included: 1, total: usable.length };
  }
  const omitted = included < usable.length ? `\n${s.omitted}\n` : "";
  return { text: head + omitted + body, included, total: usable.length };
}

/** Plain transcript for the summarizer and the clipboard (no budget). */
export function fullTranscript(title: string, turns: Turn[]): string {
  return `# ${title}\n` + turns.filter(t => t.content.trim()).map(t => `\n${speaker(t)}\n${t.content.trim()}\n`).join("");
}
