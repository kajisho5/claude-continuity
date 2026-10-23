import { useState } from "react";
import { ShieldQuestion } from "lucide-react";
import { useT } from "../i18n";
import type { ApprovalDecision, ToolApproval } from "../lib/connectors";

/** Asks before Claude runs a tool of a local MCP server, like Claude Desktop does. */
export default function ToolApprovalCard({ approval, onAnswer }: { approval: ToolApproval; onAnswer: (decision: ApprovalDecision) => void }) {
  const t = useT().message.approval;
  const [open, setOpen] = useState(false);
  return <div className="tool-approval my-[10px] flex flex-col gap-[8px] rounded-[12px] border border-line-strong bg-surface-2 px-[14px] py-[12px] font-sans shadow-[0_1px_2px_#0003]" role="alertdialog" aria-label={t.title(approval.tool, approval.server)}>
    <b className="flex items-center gap-[8px] text-[13.5px] font-medium text-ink"><ShieldQuestion size={16} className="shrink-0 text-accent" />{t.title(approval.tool, approval.server)}</b>
    <small className="text-[12px] leading-[1.6] text-muted">{t.hint}</small>
    <details className="text-[12px]" open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-subtle">{t.input}</summary>
      <pre className="m-[6px_0_0] max-h-[180px] overflow-auto rounded-[8px] border border-line bg-code p-[8px] font-mono text-[11px] leading-[1.5] whitespace-pre-wrap text-ink-3 light:text-[#DAD6CC]">{approval.input}</pre>
    </details>
    <div className="flex flex-wrap justify-end gap-[8px]">
      <button className="btn-secondary small approval-deny" onClick={() => onAnswer("deny")}>{t.deny}</button>
      <button className="btn-secondary small approval-always" onClick={() => onAnswer("always")}>{t.allowAlways}</button>
      <button className="btn-primary small approval-once" onClick={() => onAnswer("once")}>{t.allowOnce}</button>
    </div>
  </div>;
}
