import appIcon from "../assets/app-icon.png";

/** App icon composed with fresnel (brand/ClaudeContinuity.icon): the C is the monthly credit meter, the dot means "continued". */
export default function LogoMark({ size = 34, title }: { size?: number; title?: string }) {
  return <img className="logo-mark" src={appIcon} width={size} height={size} alt={title ?? ""} aria-hidden={title ? undefined : true} draggable={false} />;
}
