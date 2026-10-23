import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Sparkles, X } from "lucide-react";
import { clipToFit, fitsHandoff, fullTranscript, transcriptHandoff, HANDOFF_MAX_CHARS } from "../lib/handoff";
import { copyText } from "./MessageContent";
import { useT, intlLocale } from "../i18n";

type Turn = { role: "user" | "assistant"; content: string };
type Usage = Awaited<ReturnType<typeof window.continuity.summarizeHandoff>>["usage"];
type Props = {
  title: string; turns: Turn[]; model: string; modelLabel: string; configured: boolean;
  onUsage: (usage: Usage) => void; onNotice: (text: string, kind?: "ok" | "error") => void; onClose: () => void;
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

/** Opens a new Claude app chat prefilled with this conversation's context (the user reviews and sends it there). */
export default function HandoffDialog(p: Props) {
  const t = useT();
  const h = t.dialogs.handoff;
  const [platform, setPlatform] = useState("");
  const [mode, setMode] = useState<"summary" | "transcript">("summary");
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);
  useEffect(() => { window.continuity.mcpInfo().then(info => setPlatform(info.platform)).catch(() => setPlatform("unknown")); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.isComposing && e.keyCode !== 229) { e.stopPropagation(); p.onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [p.onClose]);
  const transcript = useMemo(() => transcriptHandoff(p.title, p.turns, platform), [p.title, p.turns, platform, t]);
  const base = mode === "summary" ? summary : transcript.text;
  const text = edited ?? base;
  const fits = fitsHandoff(text, platform);

  async function summarize() {
    setSummarizing(true);
    try {
      const result = await window.continuity.summarizeHandoff({ model: p.model, title: p.title, transcript: fullTranscript(p.title, p.turns) });
      setSummary(result.text); setEdited(null); p.onUsage(result.usage);
    } catch (e) { p.onNotice(h.summaryFailed(message(e)), "error"); }
    finally { setSummarizing(false); }
  }
  async function open(target: "desktop" | "web") {
    const final = fits ? text : clipToFit(text, platform).text;
    try {
      if (target === "web") {
        await copyText(final);
        await window.continuity.openHandoff({ text: "", target: "web" });
        p.onNotice(h.copiedForWeb);
      } else {
        await window.continuity.openHandoff({ text: final, target: "desktop" });
        p.onNotice(fits ? h.openedDesktop : h.openedClipped);
      }
      p.onClose();
    } catch (e) { p.onNotice(h.openFailed(message(e)), "error"); }
  }

  return <div className="overlay" onMouseDown={p.onClose}>
    <div className="modal handoff w-[min(640px,100%)] px-[28px] pt-[26px] pb-[22px]" role="dialog" aria-modal="true" aria-label={h.title} onMouseDown={e => e.stopPropagation()}>
      <button className="settings-close ghost-btn absolute top-[14px] right-[14px]" onClick={p.onClose} aria-label={t.common.close}><X size={18} /></button>
      <h2>{h.title}</h2>
      <p className="muted">{h.intro}</p>
      <div className="segmented mt-[14px]" role="tablist">
        <button className={mode === "summary" ? "active" : ""} onClick={() => { setMode("summary"); setEdited(null); }}>{h.modeSummary}</button>
        <button className={mode === "transcript" ? "active" : ""} onClick={() => { setMode("transcript"); setEdited(null); }}>{h.modeTranscript}</button>
      </div>
      {mode === "summary" && !summary
        ? <div className="handoff-empty mt-[12px] flex flex-col items-center gap-[12px] rounded-[12px] border border-dashed border-line-strong px-[20px] py-[26px] text-center">
          <p className="m-0 text-[12.5px] leading-[1.8] text-ink-4">{h.summaryExplain}<br />{h.summaryCost(p.modelLabel)}</p>
          <button className="btn-primary" disabled={summarizing || !p.configured || !p.turns.length} onClick={() => void summarize()}>
            <Sparkles size={14} className={summarizing ? "spin animate-spin" : ""} />{summarizing ? h.summarizing : h.createSummary}</button>
          {!p.configured && <small className="text-[11px] text-warn">{h.needsKey}</small>}
        </div>
        : <>
          <textarea className="text-input handoff-text mt-[12px] max-h-[46vh] min-h-[260px] text-[12.5px] leading-[1.7]" value={text} onChange={e => setEdited(e.target.value)} aria-label={h.contentLabel} />
          <div className="handoff-meta mt-[6px] flex items-center gap-[14px] text-[11px] text-subtle">
            <span className={fits ? "" : "over text-warn"}>{h.chars(text.length.toLocaleString(intlLocale()))}{fits ? "" : platform === "win32" && text.length <= HANDOFF_MAX_CHARS ? h.overWindows : h.over}</span>
            {mode === "transcript" && transcript.included < transcript.total && <span>{h.included(transcript.included, transcript.total)}</span>}
            {mode === "summary" && <button className="link ml-auto" onClick={() => void summarize()} disabled={summarizing}>{summarizing ? h.regenerating : h.regenerate}</button>}
          </div>
        </>}
      <div className="actions">
        <button className="btn-secondary" disabled={!text.trim()} onClick={() => void copyText(text).then(() => p.onNotice(t.common.copied))}><Copy size={13} />{t.common.copy}</button>
        <button className="btn-secondary" disabled={!text.trim()} onClick={() => void open("web")}><ExternalLink size={13} />{h.openWeb}</button>
        <button className="btn-primary" disabled={!text.trim()} onClick={() => void open("desktop")}>{h.openDesktop}</button>
      </div>
    </div>
  </div>;
}
