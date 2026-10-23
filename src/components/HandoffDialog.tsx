import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Sparkles, X } from "lucide-react";
import { clipToFit, fitsHandoff, fullTranscript, transcriptHandoff, HANDOFF_MAX_CHARS } from "../lib/handoff";
import { copyText } from "./MessageContent";

type Turn = { role: "user" | "assistant"; content: string };
type Usage = Awaited<ReturnType<typeof window.continuity.summarizeHandoff>>["usage"];
type Props = {
  title: string; turns: Turn[]; model: string; modelLabel: string; configured: boolean;
  onUsage: (usage: Usage) => void; onNotice: (text: string, kind?: "ok" | "error") => void; onClose: () => void;
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

/** Opens a new Claude app chat prefilled with this conversation's context (the user reviews and sends it there). */
export default function HandoffDialog(p: Props) {
  const [platform, setPlatform] = useState("");
  const [mode, setMode] = useState<"summary" | "transcript">("summary");
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);
  useEffect(() => { window.continuity.mcpInfo().then(info => setPlatform(info.platform)).catch(() => setPlatform("unknown")); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); p.onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [p.onClose]);
  const transcript = useMemo(() => transcriptHandoff(p.title, p.turns, platform), [p.title, p.turns, platform]);
  const base = mode === "summary" ? summary : transcript.text;
  const text = edited ?? base;
  const fits = fitsHandoff(text, platform);

  async function summarize() {
    setSummarizing(true);
    try {
      const result = await window.continuity.summarizeHandoff({ model: p.model, title: p.title, transcript: fullTranscript(p.title, p.turns) });
      setSummary(result.text); setEdited(null); p.onUsage(result.usage);
    } catch (e) { p.onNotice("要約を作成できませんでした: " + message(e), "error"); }
    finally { setSummarizing(false); }
  }
  async function open(target: "desktop" | "web") {
    const final = fits ? text : clipToFit(text, platform).text;
    try {
      if (target === "web") {
        await copyText(final);
        await window.continuity.openHandoff({ text: "", target: "web" });
        p.onNotice("内容をコピーしました。claude.ai の入力欄に貼り付けて送信してください");
      } else {
        await window.continuity.openHandoff({ text: final, target: "desktop" });
        p.onNotice(fits ? "Claude アプリを開きました。内容を確認して送信してください" : "長すぎたため末尾を省いて開きました");
      }
      p.onClose();
    } catch (e) { p.onNotice("開けませんでした: " + message(e), "error"); }
  }

  return <div className="overlay" onMouseDown={p.onClose}>
    <div className="modal handoff w-[min(640px,100%)] px-[28px] pt-[26px] pb-[22px]" role="dialog" aria-modal="true" aria-label="Claude アプリで続ける" onMouseDown={e => e.stopPropagation()}>
      <button className="settings-close ghost-btn absolute top-[14px] right-[14px]" onClick={p.onClose} aria-label="閉じる"><X size={18} /></button>
      <h2>Claude アプリで続ける</h2>
      <p className="muted">Claude デスクトップアプリの新しいチャットを、この会話の文脈を入力した状態で開きます。送信はアプリ側で内容を確認してから押してください。添付ファイルや作成したファイルは引き継がれません。</p>
      <div className="segmented mt-[14px]" role="tablist">
        <button className={mode === "summary" ? "active" : ""} onClick={() => { setMode("summary"); setEdited(null); }}>要約して引き継ぐ（おすすめ）</button>
        <button className={mode === "transcript" ? "active" : ""} onClick={() => { setMode("transcript"); setEdited(null); }}>最近のやり取りをそのまま</button>
      </div>
      {mode === "summary" && !summary
        ? <div className="handoff-empty mt-[12px] flex flex-col items-center gap-[12px] rounded-[12px] border border-dashed border-line-strong px-[20px] py-[26px] text-center">
          <p className="m-0 text-[12.5px] leading-[1.8] text-ink-4">会話全体を API で引き継ぎメモにまとめます（目的・決定事項・現状・次にやること）。<br />{p.modelLabel} を使い、API クレジットを少し使います。</p>
          <button className="btn-primary" disabled={summarizing || !p.configured || !p.turns.length} onClick={() => void summarize()}>
            <Sparkles size={14} className={summarizing ? "spin animate-spin" : ""} />{summarizing ? "要約しています…" : "引き継ぎメモを作成"}</button>
          {!p.configured && <small className="text-[11px] text-warn">API キーを設定すると使えます。</small>}
        </div>
        : <>
          <textarea className="text-input handoff-text mt-[12px] max-h-[46vh] min-h-[260px] text-[12.5px] leading-[1.7]" value={text} onChange={e => setEdited(e.target.value)} aria-label="引き継ぐ内容" />
          <div className="handoff-meta mt-[6px] flex items-center gap-[14px] text-[11px] text-subtle">
            <span className={fits ? "" : "over text-warn"}>{text.length.toLocaleString()} 文字{fits ? "" : platform === "win32" && text.length <= HANDOFF_MAX_CHARS ? " · Windows のリンク長の上限を超えるため末尾を省きます" : " · 上限を超えるため末尾を省きます"}</span>
            {mode === "transcript" && transcript.included < transcript.total && <span>直近 {transcript.included} / {transcript.total} 件を含めています</span>}
            {mode === "summary" && <button className="link ml-auto" onClick={() => void summarize()} disabled={summarizing}>{summarizing ? "作成中…" : "作り直す"}</button>}
          </div>
        </>}
      <div className="actions">
        <button className="btn-secondary" disabled={!text.trim()} onClick={() => void copyText(text).then(() => p.onNotice("コピーしました"))}><Copy size={13} />コピー</button>
        <button className="btn-secondary" disabled={!text.trim()} onClick={() => void open("web")}><ExternalLink size={13} />ブラウザの claude.ai で開く</button>
        <button className="btn-primary" disabled={!text.trim()} onClick={() => void open("desktop")}>Claude デスクトップで開く</button>
      </div>
    </div>
  </div>;
}
