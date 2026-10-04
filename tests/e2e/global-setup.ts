import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { E2E, loadState, one, saveState, withDb } from "./db";

/**
 * Sets the stage for the browser tests:
 *  - an owner and a manager to sign in as
 *  - a published test fragrance with its own stock (so the real catalogue's stock and ledger are
 *    never touched)
 *  - the test gateway and the test courier on, cash on delivery on, SMS on the dev stand-in
 * The settings and providers it changes are saved first and put back by the teardown.
 */
const SMS_AND_EMAIL = [
  "bulksmsbd",
  "sslwireless",
  "alphasms",
  "mimsms",
  "resend",
  "brevo",
  "postmark",
  "smtp",
];

export default async function globalSetup() {
  await withDb(async (db) => {
    // A run that stopped half-way: put its saved state back first
    if (loadState()) {
      const { default: teardown } = await import("./global-teardown");
      await teardown();
    }

    const settings: Record<string, unknown | null> = {};
    for (const key of ["payments", "shipping"]) {
      const row = await one<{ value: unknown } | undefined>(
        db,
        `select value from settings where key = $1`,
        [key],
      );
      settings[key] = row?.value ?? null;
    }
    const providers = ["test-gateway", "test-courier", ...SMS_AND_EMAIL];
    const integrations = (
      await db.query(`select * from integrations where provider = any($1)`, [providers])
    ).rows;
    saveState({ settings, integrations });

    // Payments: online and cash on delivery; parcels: the test courier by default
    const payments = {
      ...((settings.payments as object) ?? {}),
      sslcommerzEnabled: true,
      codEnabled: true,
    };
    const shipping = { ...((settings.shipping as object) ?? {}), defaultCourier: "mock" };
    for (const [key, value] of Object.entries({ payments, shipping }))
      await db.query(
        `insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = $2`,
        [key, JSON.stringify(value)],
      );
    // Test providers on (their default), real SMS and email off: codes and receipts stay local
    await db.query(`delete from integrations where provider in ('test-gateway', 'test-courier')`);
    await db.query(`update integrations set enabled = false where provider = any($1)`, [
      SMS_AND_EMAIL,
    ]);
    // Rate limits from earlier runs on this computer
    await db.query(
      `delete from rate_limits where key ~ ':(ip|phone):' and (key like '%::1' or key like '%127.0.0.1' or key like '%unknown' or key like '%:0177%')`,
    );

    // The team
    for (const [role, a] of [
      ["owner", E2E.owner],
      ["manager", E2E.manager],
    ] as const) {
      const id = randomUUID();
      await db.query(
        `insert into admin_users (id, name, email, email_verified, role, active) values ($1, $2, $3, true, $4, true)`,
        [id, a.name, a.email, role],
      );
      await db.query(
        `insert into admin_accounts (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`,
        [randomUUID(), id, await hashPassword(a.password)],
      );
    }

    // The test fragrance: 40 bottles, through the stock ledger like any stock
    const f = await one<{ id: number }>(
      db,
      `insert into fragrances (slug, name, tagline, story, mood, palette, cap_finish, bottle_image, bottle_alt, published, sort_order)
       values ($1, $2, 'A test.', '', 'test', $3, 'black', '/images/bottles/bond.png', 'Test bottle', true, 9999)
       returning id`,
      [
        E2E.slug,
        E2E.name,
        JSON.stringify({ bg: "#2a2830", deep: "#1c1a20", accent: "#c9bfae", ink: "#f2eee8" }),
      ],
    );
    const v = await one<{ id: number }>(
      db,
      `insert into variants (fragrance_id, sku, size_ml, price_poisha, stock) values ($1, $2, 50, 300000, 40) returning id`,
      [f.id, E2E.sku],
    );
    await db.query(
      `insert into stock_movements (variant_id, delta, type, reason) values ($1, 40, 'initial', 'zz-e2e')`,
      [v.id],
    );
  });
}
