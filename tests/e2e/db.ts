import "dotenv/config";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import pg from "pg";

/**
 * What the end-to-end tests share: a direct database connection (to set the stage and to check
 * what the browser did), the run's test accounts and test fragrance, and a little saved state so
 * the teardown restores exactly what the setup changed. Everything the tests make is marked
 * "zz-e2e" and removed at the end.
 */
export const E2E = {
  owner: { email: "zz-e2e-owner@zalfi.test", password: "e2e-owner-pass-1234", name: "E2E Owner" },
  manager: {
    email: "zz-e2e-manager@zalfi.test",
    password: "e2e-manager-pass-1234",
    name: "E2E Manager",
  },
  slug: "zz-e2e",
  sku: "ZZ-E2E-50",
  name: "Zz Test",
  /** The test discovery set: the test fragrance and two real ones, 3 × 3 ml, its own stock */
  set: { slug: "zz-e2e-set", sku: "ZZ-E2E-SET", name: "Zz Test Set" },
  /** Customers' emails: zz-e2e+<n>@example.com */
  emailDomain: "example.com",
} as const;

const STATE = path.join(process.cwd(), ".data", "e2e-state.json");

export type SavedState = { settings: Record<string, unknown | null>; integrations: unknown[] };

export const saveState = (s: SavedState) => writeFileSync(STATE, JSON.stringify(s));
export const loadState = (): SavedState | null => {
  try {
    return JSON.parse(readFileSync(STATE, "utf8")) as SavedState;
  } catch {
    return null;
  }
};
export const clearState = () => rmSync(STATE, { force: true });

export async function withDb<T>(fn: (db: pg.Client) => Promise<T>) {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error("DATABASE_URL is not set: the end-to-end tests need the local database");
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

export const one = async <T>(db: pg.Client, q: string, params: unknown[] = []) =>
  (await db.query(q, params)).rows[0] as T;

/** A sku's stock and what its ledger says (they must always agree); the test fragrance's by default */
export async function stockOf(sku: string = E2E.sku) {
  return withDb((db) =>
    one<{ stock: number; ledger: number }>(
      db,
      `select v.stock, coalesce((select sum(delta) from stock_movements m where m.variant_id = v.id), 0)::int as ledger
         from variants v where v.sku = $1`,
      [sku],
    ),
  );
}

export async function orderByNumber(number: string) {
  return withDb((db) =>
    one<{
      id: number;
      status: string;
      payment_status: string;
      total: number;
      gift_message: string | null;
    }>(db, `select id, status, payment_status, total, gift_message from orders where number = $1`, [
      number,
    ]),
  );
}
