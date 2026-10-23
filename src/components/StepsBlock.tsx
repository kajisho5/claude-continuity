import { Brain, ChevronDown, Code2, FileText, Globe, Search, Wrench } from "lucide-react";
import type { ToolStep } from "../lib/steps";

const ICONS = { search: Search, fetch: Globe, code: Code2, file: FileText, memory: Brain, other: Wrench } as const;
const hostOf = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };

function summary(steps: ToolStep[]): string {
  const count = (kind: ToolStep["kind"]) => steps.filter(s => s.kind === kind).length;
  const parts = [
    count("search") && `検索 ${count("search")} 回`, count("fetch") && `ページ読込 ${count("fetch")} 件`,
    count("code") + count("file") && `コード実行 ${count("code") + count("file")} 回`, count("memory") && `メモリ ${count("memory")} 回`, count("other") && `その他 ${count("other")} 回`
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Expandable record of the tools Claude used for a reply: queries and results, code and its output. */
export default function StepsBlock({ steps }: { steps: ToolStep[] }) {
  if (!steps.length) return null;
  return <details className="steps">
    <summary><Wrench size={13} /><span>{summary(steps)}</span>{steps.some(s => s.error) && <em>エラーあり</em>}<ChevronDown size={14} className="chev" /></summary>
    <ol className="steps-list">
      {steps.map((step, i) => {
        const Icon = ICONS[step.kind];
        const body = !!(step.detail || step.output || step.sources?.length);
        const head = <><Icon size={14} /><span className="step-label">{step.label}</span>{step.error && <em className="step-error">エラー</em>}</>;
        return <li key={i} className={"step kind-" + step.kind}>
          {body
            ? <details><summary>{head}<ChevronDown size={13} className="chev" /></summary>
              <div className="step-body">
                {step.detail && <pre className="step-code">{step.detail}</pre>}
                {step.sources?.length ? <ul className="step-sources">{step.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a><small>{hostOf(s.url)}</small></li>)}</ul> : null}
                {step.output && <pre className={"step-output" + (step.error ? " error" : "")}>{step.output}</pre>}
              </div></details>
            : <div className="step-head">{head}</div>}
        </li>;
      })}
    </ol>
  </details>;
}
