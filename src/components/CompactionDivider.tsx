import { useState } from "react";
import { Frame } from "./Dialog";
import { Markdown } from "./MessageContent";
import { useT } from "../i18n";

/** Marks where the turns sent as a summary end, with the summary itself one click away. */
export default function CompactionDivider({ count, text }: { count: number; text: string }) {
  const t = useT();
  const d = t.spend.divider;
  const [open, setOpen] = useState(false);
  return <>
    <div className="compaction-divider my-[18px] flex flex-col items-center gap-[4px]" role="separator">
      <div className="flex w-full items-center gap-[12px]">
        <span className="h-px flex-1 border-t border-dashed border-line-strong" />
        <span className="rounded-[12px] border border-line-strong bg-surface px-[12px] py-[3px] text-[11px] text-muted">{d.text(count)}</span>
        <span className="h-px flex-1 border-t border-dashed border-line-strong" />
      </div>
      <button className="link-btn summary-view self-end border-0 bg-transparent px-[4px] text-[11px] text-link hover:underline" onClick={() => setOpen(true)}>{d.view}</button>
    </div>
    {open && <Frame title={d.title} onClose={() => setOpen(false)}>
      <div className="summary-text max-h-[60vh] overflow-auto text-[13px] leading-[1.7] text-ink-3">{text.trim() ? <Markdown text={text} /> : <p className="text-muted">{d.encrypted}</p>}</div>
      <div className="actions"><button className="btn-primary" onClick={() => setOpen(false)}>{d.close}</button></div>
    </Frame>}
  </>;
}
