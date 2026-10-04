import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { E2E, clearState, loadState, withDb } from "./db";

/** Puts back what the setup changed and removes everything the tests made (all "zz-e2e") */
export default async function globalTeardown() {
  const state = loadState();
  const numbers = await withDb(async (db) => {
    const orders = (
      await db.query(`select id, number from orders where customer_email like 'zz-e2e+%'`)
    ).rows as { id: number; number: string }[];
    if (orders.length)
      await db.query(`delete from orders where id = any($1)`, [orders.map((o) => o.id)]);
    await db.query(`delete from customers where email like 'zz-e2e+%'`);
    await db.query(`delete from fragrances where slug = $1`, [E2E.slug]);
    const users = (
      await db.query(`select id from admin_users where email like 'zz-e2e-%'`)
    ).rows.map((r) => r.id as string);
    if (users.length) {
      await db.query(`delete from audit_log where actor_id = any($1)`, [users]);
      await db.query(`delete from admin_users where id = any($1)`, [users]);
    }

    if (state) {
      for (const [key, value] of Object.entries(state.settings))
        if (value === null) await db.query(`delete from settings where key = $1`, [key]);
        else
          await db.query(
            `insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = $2`,
            [key, JSON.stringify(value)],
          );
      const saved = state.integrations as Record<string, unknown>[];
      const names = new Set([
        "test-gateway",
        "test-courier",
        ...saved.map((r) => String(r.provider)),
      ]);
      await db.query(`delete from integrations where provider = any($1)`, [[...names]]);
      for (const row of saved) {
        const cols = Object.keys(row);
        await db.query(
          `insert into integrations (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
          cols.map((c) => {
            const v = row[c];
            return v !== null && typeof v === "object" && !(v instanceof Date)
              ? JSON.stringify(v)
              : v;
          }),
        );
      }
    }
    return orders.map((o) => o.number);
  });

  // The e-receipts the dev email stand-in saved for the test orders
  const outbox = path.join(process.cwd(), ".data", "outbox");
  try {
    for (const f of readdirSync(outbox))
      if (numbers.some((n) => f.includes(n))) rmSync(path.join(outbox, f), { force: true });
  } catch {
    /* no outbox yet */
  }
  clearState();
}
