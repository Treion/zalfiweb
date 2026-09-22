import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * One driver everywhere: Neon's HTTP driver works in Edge functions, Node server components and
 * scripts alike. In local development the connection string points at localhost, and requests go
 * to scripts/neon-local-proxy.ts, which speaks the same HTTP protocol against local Postgres 16.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "db.localtest.me"]);

neonConfig.fetchEndpoint = (host) =>
  LOCAL_HOSTS.has(host)
    ? `http://127.0.0.1:${process.env.NEON_LOCAL_PROXY_PORT ?? "4444"}/sql`
    : `https://${host}/sql`;

export type Db = ReturnType<typeof createDb>;

function createDb(url: string) {
  return drizzle({ client: neon(url), schema });
}

let cached: Db | null | undefined;

/** The database, or null when DATABASE_URL is not configured (callers fall back to seed data). */
export function getDb(): Db | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL;
  cached = url ? createDb(url) : null;
  return cached;
}
