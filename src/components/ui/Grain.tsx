/**
 * Film grain over the whole site, for a tactile, printed feel.
 * Procedural SVG noise, so there is no image request. The layer is 3× the viewport and shifts in
 * steps (transform only), which looks like film grain without repainting.
 */
const NOISE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`;

export function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden opacity-[0.07] mix-blend-overlay"
    >
      <div
        className="absolute -inset-full motion-safe:animate-[grain-shift_0.9s_steps(4)_infinite]"
        style={{ backgroundImage: NOISE, backgroundSize: "220px 220px" }}
      />
    </div>
  );
}
