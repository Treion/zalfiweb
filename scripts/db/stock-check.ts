/**
 * Proves the stock ledger is true: every size's current stock equals the sum of its movements.
 *   npm run stock:check     exits 1 (and lists them) if any size disagrees
 */
import "dotenv/config";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString: url });
  const { rows } = await pool.query<{ sku: string; stock: number; ledger: number }>(`
    select v.sku, v.stock, coalesce(sum(m.delta), 0)::int as ledger
    from variants v left join stock_movements m on m.variant_id = v.id
    group by v.id order by v.sku`);
  await pool.end();
  const bad = rows.filter((r) => r.stock !== r.ledger);
  for (const r of rows)
    console.log(
      `${r.stock === r.ledger ? "ok " : "BAD"}  ${r.sku.padEnd(16)} stock ${r.stock}  ledger ${r.ledger}`,
    );
  if (bad.length) {
    console.error(`\n${bad.length} size(s) disagree with the ledger.`);
    process.exit(1);
  }
  console.log(`\nAll ${rows.length} sizes match the ledger.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
