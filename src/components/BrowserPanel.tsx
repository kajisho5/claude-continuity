import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, ChevronLeft, ChevronRight, ExternalLink, Globe, Lock, RotateCw, Square, X } from "lucide-react";
import { useT } from "../i18n";

export type BrowserState = Awaited<ReturnType<typeof window.continuity.browser.state>>;
type AttachResult = Awaited<ReturnType<typeof window.continuity.browser.attachPage>>;


/**
 * The in-app browser panel. The page itself is a native view the main process lays over `.browser-view`;
 * this component reports that area's position and shows the toolbar and the "give to Claude" actions.
 */
export default function BrowserPanel({ state, covered, onClose, onAttached }: {
  state: BrowserState; covered: boolean; onClose: () => void; onAttached: (result: AttachResult) => void;
}) {
  const t = useT();
  const b = t.artifacts.browser;
  const area = useRef<HTMLDivElement>(null);
  const [address, setAddress] = useState(state.url);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasPage = !!state.url;

  useEffect(() => { if (!editing) setAddress(state.url); }, [state.url, editing]);

  // Keeps the native view over the page area: on resize, on layout changes and while the panel slides in.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    let frame = 0;
    const report = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        void window.continuity.browser.layout({ x: r.left, y: r.top, width: r.width, height: r.height }, hasPage && !covered);
      });
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    window.addEventListener("resize", report);
    el.closest("aside")?.addEventListener("transitionend", report);
    el.closest("aside")?.addEventListener("animationend", report);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", report);
      el.closest("aside")?.removeEventListener("transitionend", report);
      el.closest("aside")?.removeEventListener("animationend", report);
      void window.continuity.browser.layout({ x: 0, y: 0, width: 0, height: 0 }, false);
    };
  }, [hasPage, covered]);

  async function go() {
    if (!address.trim()) return;
    setEditing(false);
    await window.continuity.browser.open(address).catch(() => {});
  }
  async function attach(kind: "page" | "capture") {
    setBusy(true);
    try { onAttached(await (kind === "page" ? window.continuity.browser.attachPage() : window.continuity.browser.attachCapture())); }
    finally { setBusy(false); }
  }

  return <aside className="browser-panel flex min-h-0 w-[min(560px,45%)] shrink-0 animate-slide-in flex-col gap-[10px] overflow-hidden border-x border-line bg-panel px-[14px] py-[14px]" aria-label={b.label}>
    <header className="flex shrink-0 items-center gap-[8px] px-[4px] text-[12px] text-muted">
      <b className="font-serif text-[14px] font-medium text-ink">{b.label}</b>
      <span className="browser-title min-w-0 flex-1 truncate text-[11.5px]">{state.title}</span>
      <button className="icon-btn browser-external" onClick={() => void window.continuity.browser.openExternal()} disabled={!hasPage} aria-label={b.openExternal} title={b.openExternal}><ExternalLink size={15} /></button>
      <button className="icon-btn browser-close" onClick={onClose} aria-label={t.common.close}><X size={16} /></button>
    </header>
    <div className="browser-toolbar flex shrink-0 items-center gap-[4px]">
      <button className="icon-btn browser-back" onClick={() => void window.continuity.browser.back()} disabled={!state.canGoBack} aria-label={b.back} title={b.back}><ChevronLeft size={17} /></button>
      <button className="icon-btn browser-forward" onClick={() => void window.continuity.browser.forward()} disabled={!state.canGoForward} aria-label={b.forward} title={b.forward}><ChevronRight size={17} /></button>
      {state.loading
        ? <button className="icon-btn browser-stop" onClick={() => void window.continuity.browser.stop()} aria-label={b.stop} title={b.stop}><Square size={13} /></button>
        : <button className="icon-btn browser-reload" onClick={() => void window.continuity.browser.reload()} disabled={!hasPage} aria-label={b.reload} title={b.reload}><RotateCw size={15} /></button>}
      <form className="flex min-w-0 flex-1 items-center gap-[6px] rounded-[8px] border border-line-input bg-inset px-[10px]" onSubmit={e => { e.preventDefault(); void go(); }}>
        {state.url.startsWith("https://") ? <Lock size={12} className="shrink-0 text-muted" /> : <Globe size={12} className="shrink-0 text-muted" />}
        <input className="browser-address w-full min-w-0 border-0 bg-transparent py-[7px] text-[12.5px] text-ink-2 outline-none placeholder:text-faint" value={address}
          onChange={e => { setEditing(true); setAddress(e.target.value); }} onFocus={e => e.target.select()} onBlur={() => setEditing(false)}
          placeholder={b.address} aria-label={b.address} spellCheck={false} />
      </form>
    </div>
    {state.error && <p className="browser-error m-0 px-[4px] text-[12px] text-warn">{b.failed(state.error)}</p>}
    <div ref={area} className="browser-view relative min-h-0 flex-1 overflow-hidden rounded-[8px] border border-line bg-white">
      {!hasPage && <div className="browser-empty absolute inset-0 grid place-items-center bg-surface px-[24px] text-center text-[13px] text-muted">{b.empty}</div>}
    </div>
    <div className="browser-actions flex shrink-0 flex-wrap items-center gap-[8px]">
      <button className="btn-secondary browser-send-page" onClick={() => void attach("page")} disabled={!hasPage || busy}><ArrowRight size={14} /> {b.sendPage}</button>
      <button className="btn-secondary browser-send-capture" onClick={() => void attach("capture")} disabled={!hasPage || busy}><Camera size={14} /> {b.sendCapture}</button>
    </div>
  </aside>;
}
