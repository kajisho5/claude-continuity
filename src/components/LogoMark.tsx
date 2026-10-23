import appIcon from "../assets/app-icon.png";

/** App icon composed with fresnel (brand/ClaudeContinuity.icon): the C is the monthly credit meter, the dot means "continued". */
export default function LogoMark({ size = 34, title }: { size?: number; title?: string }) {
  return <img className="logo-mark" src={appIcon} width={size} height={size} alt={title ?? ""} aria-hidden={title ? undefined : true} draggable={false} />;
}

// Same geometry as brand/src/*.svg, scaled to a 48-unit box, for inline use and animation.
const TRACK = "M31.85 16.3A12.5 12.5 0 1 0 31.85 31.7";
const METER = "M31.85 16.3A12.5 12.5 0 1 0 15.38 34.6";

/** Flat vector mark. With `working`, the meter sweeps around the C and the dot breathes, like a typing indicator. */
export function LogoGlyph({ size = 24, working = false }: { size?: number; working?: boolean }) {
  return <svg className={"logo-glyph" + (working ? " working" : "")} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path className="glyph-track" d={TRACK} />
    {working
      ? <path className="glyph-sweep" d={TRACK} pathLength={100} />
      : <path className="glyph-meter" d={METER} />}
    <circle className="glyph-dot" cx="37.5" cy="24" r="3.6" />
  </svg>;
}
