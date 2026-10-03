/** Postgres error code for a unique-constraint violation, wherever drizzle put it (it wraps errors) */
export function isUniqueViolation(e: unknown): boolean {
  for (let x: unknown = e, i = 0; x && typeof x === "object" && i < 4; i++) {
    if ((x as { code?: unknown }).code === "23505") return true;
    x = (x as { cause?: unknown }).cause;
  }
  return false;
}
