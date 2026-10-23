/** "3分前" style relative time for chat lists; falls back to a date after a week. */
export function relativeTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const diff = Math.max(0, now - time);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  const d = new Date(time);
  return d.getFullYear() === new Date(now).getFullYear() ? `${d.getMonth() + 1}月${d.getDate()}日` : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** One-line plain-text preview of a Markdown reply (code blocks, table pipes, emphasis and citation markers removed). */
export function plainPreview(markdown: string, max: number): string {
  return markdown
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/\[(\d+)\]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*\|?[-:| ]+\|?\s*$/gm, " ")
    .replace(/[#>*`|_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
