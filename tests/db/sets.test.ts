import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminUsers,
  customers,
  discoverySetItems,
  discoverySets,
  fragrances,
  orderItems,
  orders,
  settings,
  stockMovements,
  variants,
} from "@/db/schema";
import { placeOrderSchema } from "@/lib/checkout";
import { listInventory } from "@/server/catalog/inventory";
import { setSetContents, updateSet, updateSetPack } from "@/server/catalog/sets";
import { adjustStock } from "@/server/catalog/stock";
import { priceBag, quoteBag } from "@/server/checkout/quote";
import { poolDb, withTx } from "@/server/db/pool";
import { placeOrder } from "@/server/orders/place";

/**
 * Discovery sets against a real database: a throwaway set of three throwaway fragrances. A set
 * sells from its own boxes; the bottles' stock never moves.
 */
const RUN = Date.now().toString(36);
const SLUG = `zz-set-${RUN}`;
const SKU = `ZZ-SET-${RUN.toUpperCase()}`;
const admin = { id: `zz-admin-${RUN}`, email: `zz-admin-${RUN}@zalfi.test` };
const actor = { id: admin.id, email: admin.email };
const phone = `0198${String(Date.now() % 10_000_000).padStart(7, "0")}`;
let setId = 0;
let packId = 0;
let bottleIds: number[] = [];
const fragranceIds: number[] = [];
const saved = new Map<string, unknown>();

const stockOf = async (id: number) =>
  (await poolDb().select({ s: variants.stock }).from(variants).where(eq(variants.id, id)))[0]!.s;
const ledgerOf = async (id: number) =>
  Number(
    (
      await poolDb()
        .select({ s: sql<number>`coalesce(sum(${stockMovements.delta}),0)::int` })
        .from(stockMovements)
        .where(eq(stockMovements.variantId, id))
    )[0]!.s,
  );

beforeAll(async () => {
  await poolDb().insert(adminUsers).values({ id: admin.id, name: "Test", email: admin.email });
  for (const n of [1, 2, 3, 4]) {
    const [f] = await poolDb()
      .insert(fragrances)
      .values({
        slug: `${SLUG}-f${n}`,
        name: `Zz F${n}`,
        tagline: "t",
        story: "",
        mood: "m",
        palette: { bg: "#000000", deep: "#000000", accent: "#ffffff", ink: "#ffffff" },
        capFinish: "black",
        bottleImage: "/x.png",
        bottleAlt: "test bottle",
        published: true,
        sortOrder: 990 + n,
      })
      .returning({ id: fragrances.id });
    fragranceIds.push(f!.id);
  }
  bottleIds = (
    await poolDb()
      .insert(variants)
      .values(
        fragranceIds.map((fragranceId, i) => ({
          fragranceId,
          sku: `${SKU}-B${i}`,
          sizeMl: 50,
          pricePoisha: 450_000,
          stock: 0,
        })),
      )
      .returning({ id: variants.id })
  ).map((v) => v.id);
  const [s] = await poolDb()
    .insert(discoverySets)
    .values({
      slug: SLUG,
      name: "Zz Set",
      tagline: "t",
      image: "/images/sets/black.webp",
      imageAlt: "a test box",
      imageWidth: 1086,
      imageHeight: 1448,
      published: true,
    })
    .returning({ id: discoverySets.id });
  setId = s!.id;
  await poolDb()
    .insert(discoverySetItems)
    .values(
      fragranceIds.slice(0, 3).map((fragranceId, position) => ({ setId, fragranceId, position })),
    );
  const [p] = await poolDb()
    .insert(variants)
    .values({ setId, sku: SKU, sizeMl: 3, pieces: 3, pricePoisha: 150_000, stock: 0 })
    .returning({ id: variants.id });
  packId = p!.id;
  await withTx(async (tx) => {
    await adjustStock(tx, { variantId: packId, delta: 4, type: "initial" });
    for (const id of bottleIds)
      await adjustStock(tx, { variantId: id, delta: 10, type: "initial" });
  });

  const value = { sslcommerzEnabled: true, codEnabled: true, unpaidExpiryMinutes: 30 };
  const [row] = await poolDb().select().from(settings).where(eq(settings.key, "payments"));
  saved.set("payments", row?.value);
  await poolDb()
    .insert(settings)
    .values({ key: "payments", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  const ids = (
    await poolDb()
      .select({ id: orders.id })
      .from(orders)
      .where(sql`${orders.idempotencyKey} like ${`${SLUG}-%`}`)
  ).map((o) => o.id);
  if (ids.length) await poolDb().delete(orders).where(inArray(orders.id, ids));
  await poolDb().delete(customers).where(eq(customers.phone, phone));
  await poolDb().delete(discoverySets).where(eq(discoverySets.id, setId));
  await poolDb().delete(fragrances).where(inArray(fragrances.id, fragranceIds));
  await poolDb().execute(sql`delete from audit_log where actor_id = ${admin.id}`);
  await poolDb().delete(adminUsers).where(eq(adminUsers.id, admin.id));
  const value = saved.get("payments");
  if (value === undefined) await poolDb().delete(settings).where(eq(settings.key, "payments"));
  else await poolDb().update(settings).set({ value }).where(eq(settings.key, "payments"));
});

describe("discovery sets", () => {
  it("prices a set by its pack, named after the set", async () => {
    const { lines, unavailable } = await priceBag(poolDb(), [{ sku: SKU, qty: 2 }]);
    expect(unavailable).toEqual([]);
    expect(lines[0]).toMatchObject({
      sku: SKU,
      name: "Zz Set",
      setId,
      fragranceId: null,
      sizeMl: 3,
      pieces: 3,
      lineTotal: 300_000,
      available: 4,
    });
    const q = await quoteBag({ items: [{ sku: SKU, qty: 1 }] }, null);
    expect(q.lines[0]).toMatchObject({ pieces: 3, sizeMl: 3 });
  });

  it("sells from its own boxes: the bottles inside don't move", async () => {
    const bottlesBefore = await Promise.all(bottleIds.map(stockOf));
    const items = [{ sku: SKU, qty: 1 }];
    const q = await quoteBag({ items, district: "Dhaka", area: "Dhanmondi" }, phone);
    const placed = await placeOrder(
      placeOrderSchema.parse({
        name: "Set Buyer",
        phone,
        email: "set-buyer@example.com",
        district: "Dhaka",
        area: "Dhanmondi",
        street: "House 1, Road 1",
        items,
        paymentMethod: "cod",
        expectedTotal: q.total,
        idempotencyKey: `${SLUG}-1`,
      }),
      phone,
    );
    expect(placed.status).toBe("confirmed");
    expect(await stockOf(packId)).toBe(3);
    expect(await ledgerOf(packId)).toBe(3);
    expect(await Promise.all(bottleIds.map(stockOf))).toEqual(bottlesBefore);

    const [o] = await poolDb().select().from(orders).where(eq(orders.number, placed.number));
    const [item] = await poolDb().select().from(orderItems).where(eq(orderItems.orderId, o!.id));
    expect(item).toMatchObject({ setId, fragranceId: null, sizeMl: 3, pieces: 3, name: "Zz Set" });
  });

  it("shows in Inventory as a set, with its own stock", async () => {
    const row = (await listInventory()).find((r) => r.variantId === packId);
    expect(row).toMatchObject({ setId, fragranceId: null, name: "Zz Set", pieces: 3, stock: 3 });
  });

  it("can't be bought while hidden, or with its pack switched off", async () => {
    await updateSet(
      setId,
      {
        name: "Zz Set",
        tagline: "t",
        story: "",
        imageAlt: "a test box",
        sortOrder: 0,
        published: false,
      },
      actor,
    );
    expect((await priceBag(poolDb(), [{ sku: SKU, qty: 1 }])).unavailable).toEqual([SKU]);
    await updateSetPack(
      setId,
      { sizeMl: 3, pricePoisha: 150_000, lowStockThreshold: null, active: false },
      actor,
    );
    // A set can't go back on the shop with no pack on sale
    await expect(
      updateSet(
        setId,
        {
          name: "Zz Set",
          tagline: "t",
          story: "",
          imageAlt: "a test box",
          sortOrder: 0,
          published: true,
        },
        actor,
      ),
    ).rejects.toThrow(/Switch the pack on/);
    await updateSetPack(
      setId,
      { sizeMl: 3, pricePoisha: 160_000, lowStockThreshold: null, active: true },
      actor,
    );
    await updateSet(
      setId,
      {
        name: "Zz Set",
        tagline: "t",
        story: "",
        imageAlt: "a test box",
        sortOrder: 0,
        published: true,
      },
      actor,
    );
    const { lines } = await priceBag(poolDb(), [{ sku: SKU, qty: 1 }]);
    expect(lines[0]?.unitPrice).toBe(160_000);
  });

  it("changes what's in the box, and keeps a shown set from losing its pack", async () => {
    await setSetContents(setId, [fragranceIds[3]!, fragranceIds[0]!, fragranceIds[1]!], actor);
    const items = await poolDb()
      .select()
      .from(discoverySetItems)
      .where(eq(discoverySetItems.setId, setId));
    expect(items.sort((a, b) => a.position - b.position).map((i) => i.fragranceId)).toEqual([
      fragranceIds[3],
      fragranceIds[0],
      fragranceIds[1],
    ]);
    await expect(
      updateSetPack(
        setId,
        { sizeMl: 3, pricePoisha: 160_000, lowStockThreshold: null, active: false },
        actor,
      ),
    ).rejects.toThrow(/Hide the set/);
  });

  it("keeps a variant to exactly one owner", async () => {
    await expect(
      poolDb()
        .insert(variants)
        .values({ sku: `${SKU}-ORPHAN`, sizeMl: 3, pricePoisha: 100, stock: 0 }),
    ).rejects.toThrow();
    await expect(
      poolDb()
        .insert(variants)
        .values({
          sku: `${SKU}-BOTH`,
          fragranceId: fragranceIds[0]!,
          setId,
          sizeMl: 3,
          pricePoisha: 100,
          stock: 0,
        }),
    ).rejects.toThrow();
  });
});
