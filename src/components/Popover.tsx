import { useEffect, useRef, useState } from "react";

/** Open state for a click-to-open menu that closes on outside click or Escape. */
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", onKey, true); };
  }, [open]);
  return { open, setOpen, ref };
}
