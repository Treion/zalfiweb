import { LOGO_PARTS, LOGO_VIEWBOX } from "@/components/brand/logo-paths";

const EMBLEM = ["cap", "body"];

/**
 * The landing: the ZALFI emblem and wordmark, alone in the dark. On load the emblem assembles and
 * the letters rise into place (time-based, once; see the experience timeline), then everything is
 * still. Scrolling lets the logo sink back while the six bottles rise into the line-up. The static
 * layout shows the same logo as a quiet first screen.
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

      <div
        data-intro-cue
        aria-hidden
        className="static:hidden absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        <span data-intro-meta data-reveal className="eyebrow text-bone-dim text-[0.6rem]">
          Scroll
        </span>
        <span data-intro-meta data-reveal className="bg-bone/30 block h-8 w-px" />
      </div>
    </div>
  );
}
