/** Format integer cents as a price, e.g. 14500 → "$145". Cents are shown only when present. */
export function formatPrice(cents: number, currency = "USD", locale = "en-US") {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}
