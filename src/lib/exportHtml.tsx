import { renderToStaticMarkup } from "react-dom/server";
import hljsCss from "highlight.js/styles/github.css?raw";
import { Markdown, linkCitations } from "../components/MessageContent";
import type { Msg } from "../components/MessageItem";

type ExportChat = { title: string; messages: Msg[]; updatedAt?: string };

const CSS = `
body{margin:0;background:#FAF9F5;color:#29271F;font:15px/1.8 "Hiragino Sans","Yu Gothic UI","Noto Sans JP",system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 24px 80px}
header{border-bottom:1px solid #E6E2D8;margin-bottom:28px;padding-bottom:14px}
header h1{font:600 24px/1.4 "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif;margin:0 0 6px}
header p{margin:0;color:#8B867B;font-size:12px}
.turn{margin:0 0 26px}
.user{display:flex;justify-content:flex-end}
.user .bubble{max-width:88%;background:#EFECE3;border-radius:18px;padding:10px 16px;white-space:pre-wrap;overflow-wrap:anywhere}
.files{font-size:12px;color:#6E6A61;margin:4px 0;text-align:right}
.assistant .markdown{font-family:"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",Georgia,serif;font-size:16px}
.markdown table{border-collapse:collapse;margin:.8em 0}.markdown th,.markdown td{border:1px solid #DAD5C9;padding:6px 10px}
.markdown code{font:.88em ui-monospace,Menlo,Consolas,monospace;background:#EFECE3;border-radius:4px;padding:.1em .35em}
.code-block{border:1px solid #E6E2D8;border-radius:10px;overflow:hidden;margin:.8em 0}
.code-head{background:#F3F1EA;padding:4px 12px;font:11px ui-monospace,monospace;color:#6E6A61}
.code-block pre{margin:0;padding:12px 14px;overflow-x:auto;background:#fff}.code-block pre code{background:none;padding:0}
.copy-btn,.code-actions,.artifact-code-toggle{display:none}
.artifact-card{border:1px solid #DAD5C9;border-radius:12px;padding:10px 14px;margin:.8em 0;font-family:sans-serif}
.artifact-meta{display:flex;flex-direction:column}.artifact-meta small{color:#8B867B}.artifact-thumb,.artifact-open{display:none}
.sources{font-size:12px;color:#6E6A61;border-top:1px solid #E6E2D8;margin-top:10px;padding-top:6px}
.sources a{color:#2F69BD}
.markdown a[title]{font-size:11px;vertical-align:2px;text-decoration:none}
footer{margin-top:40px;color:#A29D91;font-size:11px;text-align:center}
`;

function Transcript({ chat }: { chat: ExportChat }) {
  return <main>
    <header><h1>{chat.title}</h1><p>Claude Continuity から書き出した会話{chat.updatedAt ? ` · ${new Date(chat.updatedAt).toLocaleString("ja-JP")}` : ""}</p></header>
    {chat.messages.filter(m => m.content || m.attachments?.length).map((m, i) => m.role === "user"
      ? <section key={i} className="turn">
        {!!m.attachments?.length && <p className="files">添付: {m.attachments.map(a => a.name).join("、")}</p>}
        <div className="user"><div className="bubble">{m.content}</div></div>
      </section>
      : <section key={i} className="turn assistant">
        <Markdown text={linkCitations(m.content, m.citations)} />
        {!!m.files?.length && <p className="files">作成したファイル: {m.files.map(f => f.name).join("、")}</p>}
        {!!m.citations?.length && <div className="sources">出典: {m.citations.map((c, n) => <span key={c.url}>{n ? " / " : ""}[{n + 1}] <a href={c.url}>{c.title}</a></span>)}</div>}
      </section>)}
    <footer>Claude の回答には誤りが含まれることがあります。</footer>
  </main>;
}

/** A self-contained HTML page of the conversation, rendered from the same React components as the app. */
export function chatToHtml(chat: ExportChat): string {
  const body = renderToStaticMarkup(<Transcript chat={chat} />);
  const title = chat.title.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>`
    + `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css"><style>${CSS}${hljsCss}</style></head><body>${body}</body></html>`;
}
