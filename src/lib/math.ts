/**
 * Prepares LaTeX for remark-math with single-dollar math disabled (so prices like "$10 と $200" stay text):
 * \[…\] becomes a $$ block and \(…\) becomes inline $$…$$. Fenced and inline code are left untouched.
 */
export function normalizeMath(text: string): string {
  if (!text.includes("\\(") && !text.includes("\\[")) return text;
  return text.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g).map((part, i) => i % 2 === 1 ? part : part
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, body: string) => `\n$$\n${body.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, body: string) => `$$${body.trim()}$$`)
  ).join("");
}
