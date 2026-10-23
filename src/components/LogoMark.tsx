import appIcon from "../assets/app-icon.png";

/** App icon composed with fresnel (brand/ClaudeContinuity.icon): the C is the monthly credit meter, the dot means "continued". */
export default function LogoMark({ size = 34, title }: { size?: number; title?: string }) {
  return <img className="logo-mark block select-none" src={appIcon} width={size} height={size} alt={title ?? ""} aria-hidden={title ? undefined : true} draggable={false} />;
}

// Same geometry as brand/src/*.svg, scaled to a 48-unit box, for inline use and animation.
const STROKE = "fill-none [stroke-width:6] [stroke-linecap:round]";
const TRACK = "M31.85 16.3A12.5 12.5 0 1 0 31.85 31.7";
const METER = "M31.85 16.3A12.5 12.5 0 1 0 15.38 34.6";

/** Flat vector mark. With `working`, the meter sweeps around the C and the dot breathes, like a typing indicator. */
export function LogoGlyph({ size = 24, working = false }: { size?: number; working?: boolean }) {
  return <svg className={"logo-glyph" + (working ? " working" : "")} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path className={"glyph-track stroke-glyph-track " + STROKE} d={TRACK} />
    {working
      ? <path className={"glyph-sweep stroke-accent [stroke-dasharray:22_78] animate-[sweep_1.3s_var(--ease)_infinite] " + STROKE} d={TRACK} pathLength={100} />
      : <path className={"glyph-meter stroke-accent " + STROKE} d={METER} />}
    <circle className={"glyph-dot fill-[#D9774F] origin-[37.5px_24px]" + (working ? " animate-[breathe_1.3s_ease-in-out_infinite]" : "")} cx="37.5" cy="24" r="3.6" />
  </svg>;
}
