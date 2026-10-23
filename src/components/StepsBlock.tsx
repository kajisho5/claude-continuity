import { Brain, ChevronDown, Code2, FileText, Globe, History, Plug, Search, Wrench } from "lucide-react";
import type { ToolStep } from "../lib/steps";

const ICONS = { search: Search, fetch: Globe, code: Code2, file: FileText, memory: Brain, history: History, connector: Plug, other: Wrench } as const;
const hostOf = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };

function summary(steps: ToolStep[]): string {
  const count = (kind: ToolStep["kind"]) => steps.filter(s => s.kind === kind).length;
  const parts = [
    count("search") && `検索 ${count("search")} 回`, count("fetch") && `ページ読込 ${count("fetch")} 件`,
    count("code") + count("file") && `コード実行 ${count("code") + count("file")} 回`, count("memory") && `メモリ ${count("memory")} 回`, count("history") && `過去の会話を検索 ${count("history")} 回`, count("connector") && `コネクタ ${count("connector")} 回`, count("other") && `その他 ${count("other")} 回`
  ].filter(Boolean);
  return parts.join(" · ");
}

const CHEV = "chev transition-transform duration-200 ease-claude";
/** `.step summary, .step-head` */
const STEP_ROW = "flex list-none items-center gap-[8px] rounded-[7px] px-[8px] py-[5px] text-[12.5px] text-ink-4";
/** `.step-code, .step-output` */
const STEP_PRE = "m-0 max-h-[260px] overflow-auto rounded-[9px] border px-[11px] py-[9px] font-mono text-[11.5px] leading-[1.6] [word-break:break-word] whitespace-pre-wrap";

/** Expandable record of the tools Claude used for a reply: queries and results, code and its output. */
export default function StepsBlock({ steps }: { steps: ToolStep[] }) {
  if (!steps.length) return null;
  return <details className="steps group/steps mt-0 mx-0 mb-[12px] font-sans">
    <summary className="inline-flex cursor-pointer list-none items-center gap-[7px] rounded-[9px] border border-line-strong py-[5px] pr-[10px] pl-[9px] text-[12.5px] text-muted select-none hover:border-line-input hover:text-ink-2 [&::-webkit-details-marker]:hidden"><Wrench size={13} /><span>{summary(steps)}</span>{steps.some(s => s.error) && <em className="text-[11px] text-warn not-italic">エラーあり</em>}<ChevronDown size={14} className={CHEV + " group-open/steps:rotate-180"} /></summary>
    <ol className="steps-list mt-[8px] mx-0 mb-0 flex animate-fade-in list-none flex-col gap-[2px] border-l-2 border-line-strong py-0 pr-0 pl-[12px]">
      {steps.map((step, i) => {
        const Icon = ICONS[step.kind];
        const body = !!(step.detail || step.output || step.sources?.length);
        const head = <><Icon size={14} /><span className="step-label min-w-0 flex-1 truncate">{step.label}</span>{step.error && <em className="step-error rounded-[6px] border border-danger/50 px-[6px] py-0 text-[10.5px] text-danger not-italic">エラー</em>}</>;
        return <li key={i} className={"step kind-" + step.kind + " [&_svg]:shrink-0 [&_svg]:text-muted"}>
          {body
            ? <details className="group/step"><summary className={STEP_ROW + " cursor-pointer hover:bg-surface [&::-webkit-details-marker]:hidden"}>{head}<ChevronDown size={13} className={CHEV + " group-open/step:rotate-180"} /></summary>
              <div className="step-body mt-[4px] mr-0 mb-[8px] ml-[30px] flex flex-col gap-[6px]">
                {step.detail && <pre className={"step-code " + STEP_PRE + " border-line bg-code text-[#DAD6CC]"}>{step.detail}</pre>}
                {step.sources?.length ? <ul className="step-sources m-0 flex list-none flex-col gap-[3px] p-0">{step.sources.map(s => <li key={s.url} className="flex min-w-0 items-baseline gap-[8px] text-[12px]"><a className="truncate no-underline hover:underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a><small className="shrink-0 text-[10.5px] text-subtle">{hostOf(s.url)}</small></li>)}</ul> : null}
                {step.output && <pre className={"step-output " + STEP_PRE + " border-line bg-inset " + (step.error ? "error text-danger" : "text-ink-4")}>{step.output}</pre>}
              </div></details>
            : <div className={"step-head " + STEP_ROW + " cursor-default"}>{head}</div>}
        </li>;
      })}
    </ol>
  </details>;
}
