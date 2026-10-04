import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

/**
 * The transactional database: Neon's WebSocket `Pool` driver, used for every write that touches
 * money or stock (and by the admin's auth). The storefront's reads stay on the HTTP driver
 * (src/db/client.ts), which is edge-portable but cannot run interactive transactions.
 *
 * Node runtime only. Locally, scripts/db/neon-local-proxy.ts bridges these WebSockets to Postgres 16,
 * so development runs the same driver code as production.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "db.localtest.me"]);

neonConfig.webSocketConstructor = ws;

export type PoolDb = ReturnType<typeof create>;
/** The transaction handle drizzle passes to `withTx` callbacks */
export type Tx = Parameters<Parameters<PoolDb["transaction"]>[0]>[0];
/** Anything that can run queries: the pool itself or an open transaction */
export type Executor = PoolDb | Tx;

function create(url: string) {
  const host = new URL(url).hostname;
  if (LOCAL_HOSTS.has(host)) {
    const port = env("NEON_LOCAL_PROXY_PORT") ?? "4444";
    neonConfig.wsProxy = (h, p) => `127.0.0.1:${port}/v2?address=${h}:${p}`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
  }
  const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 20_000 });
  pool.on("error", (err: Error) => console.error("[db pool]", err.message));
  return drizzle({ client: pool, schema });
}

let cached: PoolDb | undefined;

/** The pooled, transaction-capable database. Throws when DATABASE_URL is missing. */
export function poolDb(): PoolDb {
  if (cached) return cached;
  const url = env("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is not set: the backend needs a database");
  cached = create(url);
  return cached;
}

/**
 * Runs `fn` in one database transaction: everything commits together or nothing does. Use it for
 * every change to stock, orders and money.
 */
export function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return poolDb().transaction(fn);
}
