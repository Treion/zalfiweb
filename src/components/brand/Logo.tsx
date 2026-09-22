import type { SVGProps } from "react";
import {
  EMBLEM_VIEWBOX,
  LOGO_PARTS,
  LOGO_VIEWBOX,
  WORDMARK_VIEWBOX,
  type LogoPartId,
} from "./logo-paths";

type Variant = "full" | "wordmark" | "emblem";

const PARTS: Record<Variant, LogoPartId[]> = {
  full: ["cap", "body", "z", "a", "l", "f", "i"],
  wordmark: ["z", "a", "l", "f", "i"],
  emblem: ["cap", "body"],
};

const VIEWBOX: Record<Variant, string> = {
  full: LOGO_VIEWBOX,
  wordmark: WORDMARK_VIEWBOX,
  emblem: EMBLEM_VIEWBOX,
};

type LogoProps = Omit<SVGProps<SVGSVGElement>, "viewBox"> & {
  variant?: Variant;
  /** Accessible name. Pass null when the logo is decorative next to visible text. */
  title?: string | null;
};

/**
 * The ZALFI logo, traced from the owner's artwork (public/brand/logo.png).
 * The brand name is ALWAYS rendered with this component, never typeset in a font.
 * Every part carries data-logo-part="cap|body|z|a|l|f|i" so animations can target pieces.
 */
export function Logo({ variant = "full", title = "ZALFI", ...props }: LogoProps) {
  const ids = PARTS[variant];
  return (
    <svg
      viewBox={VIEWBOX[variant]}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...props}
    >
      {LOGO_PARTS.filter((p) => ids.includes(p.id)).map((p) => (
        <path key={p.id} d={p.d} data-logo-part={p.id} />
      ))}
    </svg>
  );
}
