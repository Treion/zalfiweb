/**
 * Money is stored as integer poisha (1 taka = 100 poisha), BDT only.
 * formatPrice(125000) → "৳1,250", formatPrice(12500000) → "৳1,25,000" (Bangladeshi lakh grouping).
 * Poisha are shown only when present: formatPrice(12550) → "৳125.50".
 */
export function formatPrice(poisha: number) {
  const sign = poisha < 0 ? "−" : "";
  const abs = Math.abs(Math.round(poisha));
  const whole = abs % 100 === 0;
  const taka = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(abs / 100);
  return `${sign}৳${taka}`;
}

/** Taka (as typed in a form) → poisha. Rounds to the nearest poisha. */
export const takaToPoisha = (taka: number) => Math.round(taka * 100);

/** Poisha → taka, for form fields */
export const poishaToTaka = (poisha: number) => poisha / 100;
