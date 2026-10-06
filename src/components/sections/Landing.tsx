import Link from "next/link";
import { LOGO_PARTS, LOGO_VIEWBOX } from "@/components/brand/logo-paths";
import { HomeLink } from "./HomeLink";

const EMBLEM = ["cap", "body"];

/**
 * The landing: the ZALFI emblem and wordmark in the dark, and three ways in: Shop, Explore the
 * worlds (the scroll), Find yours. On load the emblem assembles and the letters rise into place, the
 * choices fade in under them (time-based, once; see the experience timeline), then everything is
 * still. Scrolling fades the choices first, then lets the logo sink back while the six bottles rise
 * into the line-up. The static layout shows the same logo and choices as a quiet first screen.
 */
export function Landing() {
  const emblem = LOGO_PARTS.filter((p) => EMBLEM.includes(p.id));
  const letters = LOGO_PARTS.filter((p) => !EMBLEM.includes(p.id));
  const wm = letters.reduce(
    (b, p) => [
      Math.min(b[0], p.box[0]),
      Math.min(b[1], p.box[1]),
      Math.max(b[2], p.box[2]),
      Math.max(b[3], p.box[3]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  return (
    <div
      data-landing
      className="px-gutter text-bone static:relative static:min-h-svh pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
    >
      <h1 className="sr-only">ZALFI, eau de parfum</h1>
      <div data-intro className="w-[min(60vw,24rem)] md:w-[min(30vw,30rem)]">
        <svg
          viewBox={LOGO_VIEWBOX}
          fill="currentColor"
          aria-hidden
          className="block w-full overflow-visible"
        >
          <defs>
            {/* The letters rise from behind their own baseline */}
            <clipPath id="zalfi-landing-clip">
              <rect
                x={wm[0] - 40}
                y={wm[1] - 30}
                width={wm[2] - wm[0] + 80}
                height={wm[3] - wm[1] + 34}
              />
            </clipPath>
          </defs>
          {emblem.map((p) => (
            <path key={p.id} d={p.d} data-logo-part={p.id} data-reveal />
          ))}
          <g clipPath="url(#zalfi-landing-clip)">
            {letters.map((p) => (
              // The load rise moves the path; the scroll drift moves its group (never both on one
              // SVG element: GSAP folds SVG percentages into px when it re-reads the matrix)
              <g key={p.id} data-logo-letter>
                <path d={p.d} data-logo-part={p.id} data-letter-rise data-reveal />
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Above the line-up layer (a later sibling), and hidden with autoAlpha once scrolled away */}
      <nav
        aria-label="Start"
        data-intro-choices
        className="pointer-events-auto relative z-10 mt-10 flex flex-col items-center gap-6 md:mt-14"
      >
        <div className="flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Link
            href="/fragrances"
            data-intro-choice
            data-reveal
            data-cursor="Shop"
            className="eyebrow bg-bone text-noir hover:bg-bone/85 px-8 py-4 text-center transition-colors sm:min-w-44"
          >
            Shop
          </Link>
          <HomeLink
            to="collection"
            data-intro-choice
            data-reveal
            data-cursor="Explore"
            className="eyebrow border-bone/40 hover:border-bone border px-8 py-4 text-center transition-colors sm:min-w-44"
          >
            Explore the worlds
          </HomeLink>
        </div>
        <Link
          href="/find"
          data-intro-choice
          data-reveal
          className="eyebrow text-bone-dim hover:text-bone border-bone/30 border-b pb-1 transition-colors"
        >
          Not sure? Find yours
        </Link>
      </nav>

      <div
        data-intro-cue
        aria-hidden
        className="static:hidden absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        <span data-intro-meta data-reveal className="eyebrow text-bone-dim text-[0.6rem]">
          Or scroll
        </span>
        <span data-intro-meta data-reveal className="bg-bone/30 block h-8 w-px" />
      </div>
    </div>
  );
}
