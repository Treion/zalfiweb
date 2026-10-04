/** A Postgres error code, wherever drizzle put it (it wraps errors) */
function hasCode(e: unknown, code: string): boolean {
  for (let x: unknown = e, i = 0; x && typeof x === "object" && i < 4; i++) {
    if ((x as { code?: unknown }).code === code) return true;
    x = (x as { cause?: unknown }).cause;
  }
  return false;
}

/** A unique-constraint violation */
export const isUniqueViolation = (e: unknown) => hasCode(e, "23505");

/** A table that doesn't exist yet: the database is behind the code (run npm run db:migrate) */
export const isMissingTable = (e: unknown) => hasCode(e, "42P01");
