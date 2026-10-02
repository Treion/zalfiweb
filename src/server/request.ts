/** The client's IP as the platform reports it (Vercel sets x-forwarded-for). Null if unknown. */
export function clientIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || null;
  return headers.get("x-real-ip");
}

/** 01712345678 → 017•••••678, for logs */
export const maskPhone = (phone: string) =>
  phone.length < 7
    ? "•••"
    : `${phone.slice(0, 3)}${"•".repeat(phone.length - 6)}${phone.slice(-3)}`;
