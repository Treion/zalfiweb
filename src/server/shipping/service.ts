import { and, asc, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { orderItems, orders, returns, shipments } from "@/db/schema";
import { formatPrice } from "@/lib/money";
import { audit, type Actor } from "@/server/audit";
import { revalidateStorefront } from "@/server/catalog/products";
import { poolDb, withTx, type Tx } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";
import { addEvent } from "@/server/orders/events";
import { transitionOrder } from "@/server/orders/manage";
import { TRANSITIONS, type OrderStatus } from "@/server/orders/state";
import { firstDelivery } from "@/server/payments/service";
import { getSettings } from "@/server/settings";
import { courier, courierForNew, pathaoCourier, redxCourier } from "./couriers";
import type { ManualStatus } from "./manual";
import { shipmentLabel } from "./shipment-meta";
import { mockWebhook } from "./mock";
import { matchPlace } from "./pathao-geo";
import type { MockStatus } from "./status-mock";
import type { ReturnCondition } from "./returns-meta";
import { CANCELLED_HERE, COURIER_LABELS, type CourierName, type ShipmentInput } from "./types";

/**
 * Shipping, the same for every courier:
 *  - sendToCourier: the courier takes the parcel (with the cash to collect for cash on delivery,
 *    nothing for orders paid online); the order is packed and waits for pickup.
 *  - applyCourierStatus: each status the courier reports (webhook, poll, the test courier's
 *    buttons, or the team's own updates for another courier) is mapped to an order state and the order moves along the state machine to it,
 *    through any steps in between. Stale or repeated updates change nothing.
 *  - recordReturn: a parcel that came back, with the reason, its condition and whether the
 *    bottles went back on the shelf.
 */

type ShipmentRow = typeof shipments.$inferSelect;

/** Cash the courier collects: the total for an unpaid cash-on-delivery order, otherwise nothing */
export const codAmountFor = (o: { paymentMethod: string; paymentStatus: string; total: number }) =>
  o.paymentMethod === "cod" && o.paymentStatus === "unpaid" ? o.total : 0;

const NOT_THROUGH: OrderStatus[] = ["cancelled", "returned", "return_requested", "pending_payment"];

/**
 * The steps from one order state to another along the state machine (shortest path), or null
 * when the order can't get there (a late "in transit" after "delivered", say).
 */
export function pathTo(from: OrderStatus, to: OrderStatus): OrderStatus[] | null {
  if (from === to) return [];
  const prev = new Map<OrderStatus, OrderStatus>();
  const queue: OrderStatus[] = [from];
  while (queue.length) {
    const s = queue.shift()!;
    for (const n of TRANSITIONS[s]) {
      if (prev.has(n) || n === from) continue;
      if (n !== to && NOT_THROUGH.includes(n)) continue;
      prev.set(n, s);
      if (n === to) {
        const path: OrderStatus[] = [n];
        for (let p = s; p !== from; p = prev.get(p)!) path.unshift(p);
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

const withRaw = (prev: unknown, source: string, data: unknown) => [
  ...(Array.isArray(prev) ? prev : []).slice(-40),
  { at: new Date().toISOString(), source, data },
];

/** The order's shipment that is still under way, if any */
export async function activeShipment(exec: Tx | ReturnType<typeof poolDb>, orderId: number) {
  const [s] = await exec
    .select()
    .from(shipments)
    .where(and(eq(shipments.orderId, orderId), eq(shipments.active, true)))
    .orderBy(desc(shipments.id))
    .limit(1);
  return s ?? null;
}

/** For the send dialog: Pathao's cities and zones, with the ones matching the address chosen */
export async function pathaoPlaces(orderId: number, cityId?: number) {
  const p = await pathaoCourier();
  if (!p) throw new UserFacingError("Pathao isn't set up yet.");
  const [o] = await poolDb().select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) throw new UserFacingError("That order no longer exists.");
  const cities = await p.cities();
  const city = cityId ? cities.find((c) => c.id === cityId) : matchPlace(cities, o.addressDistrict);
  const zones = city ? await p.zones(city.id) : [];
  const zone = matchPlace(zones, o.addressArea);
  return { cities, zones, cityId: city?.id ?? null, zoneId: zone?.id ?? null };
}

async function autoPathao(district: string, area: string) {
  const p = await pathaoCourier();
  if (!p) return null;
  const city = matchPlace(await p.cities(), district);
  if (!city) return null;
  const zone = matchPlace(await p.zones(city.id), area);
  return zone ? { cityId: city.id, zoneId: zone.id } : null;
}

/** For the send dialog: RedX's delivery areas in the customer's district, with the match chosen */
export async function redxPlaces(orderId: number) {
  const r = await redxCourier();
  if (!r) throw new UserFacingError("RedX isn't set up yet.");
  const [o] = await poolDb().select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) throw new UserFacingError("That order no longer exists.");
  const areas = await r.areas(o.addressDistrict);
  const match = matchPlace(areas, o.addressArea) ?? matchPlace(areas, o.addressDistrict);
  return { areas, areaId: match?.id ?? null };
}

async function autoRedx(district: string, area: string) {
  const r = await redxCourier();
  if (!r) return null;
  const areas = await r.areas(district);
  const match = matchPlace(areas, area) ?? matchPlace(areas, district);
  return match ? { areaId: match.id, areaName: match.name } : null;
}

/**
 * Hands an order to a courier. The order must be confirmed or packed (and paid, if it was paid
 * online), with no parcel already under way. A placeholder shipment is written first, so a double
 * click can't create two parcels.
 */
export async function sendToCourier(
  orderId: number,
  opts: {
    courier?: CourierName;
    pathao?: { cityId: number; zoneId: number; areaId?: number | null };
    redx?: { areaId: number; areaName: string };
    manual?: ShipmentInput["manual"];
  },
  admin: Actor,
) {
  const name = opts.courier ?? (await getSettings("shipping")).defaultCourier;
  const provider = await courierForNew(name);
  const label =
    name === "manual" && opts.manual?.courierName ? opts.manual.courierName : COURIER_LABELS[name];
  if (!provider)
    throw new UserFacingError(
      `${label} is switched off or not set up (Admin → Integrations). Choose another courier.`,
    );
  if (name === "manual" && !opts.manual?.courierName.trim())
    throw new UserFacingError("Say which courier, or rider, takes the parcel.");

  const prep = await withTx(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o) throw new UserFacingError("That order no longer exists.");
    if (o.status === "pending_payment")
      throw new UserFacingError(`${o.number} hasn't been paid yet.`);
    if (o.status !== "confirmed" && o.status !== "packed")
      throw new UserFacingError(
        `${o.number} is ${o.status.replace(/_/g, " ")}: only confirmed or packed orders can be sent.`,
      );
    const current = await activeShipment(tx, orderId);
    if (current)
      throw new UserFacingError(`${o.number} is already with ${shipmentLabel(current)}.`);
    const [{ n }] = (await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(shipments)
      .where(eq(shipments.orderId, orderId))) as [{ n: number }];
    const codAmount = codAmountFor(o);
    const [placeholder] = await tx
      .insert(shipments)
      .values({ orderId, courier: name, status: "creating", codAmount, active: true })
      .returning({ id: shipments.id });
    const items = await tx
      .select({ name: orderItems.name, qty: orderItems.qty })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.id));
    return {
      o,
      shipmentId: placeholder!.id,
      codAmount,
      items,
      reference: n ? `${o.number}-${n + 1}` : o.number,
    };
  });

  const { o, shipmentId, codAmount, items, reference } = prep;
  const fail = async (reason: string) => {
    await withTx(async (tx) => {
      await tx.delete(shipments).where(eq(shipments.id, shipmentId));
      await addEvent(tx, orderId, {
        type: "courier",
        actor: `admin:${admin.id}`,
        message: `${label} didn't take the parcel: ${reason}`,
      });
    });
    return new UserFacingError(`${label} didn't take ${o.number}: ${reason}`);
  };

  let pathaoPlace = opts.pathao;
  if (name === "pathao" && !pathaoPlace) {
    pathaoPlace =
      (await autoPathao(o.addressDistrict, o.addressArea).catch(() => null)) ?? undefined;
    if (!pathaoPlace)
      throw await fail("its city and zone couldn't be matched. Choose them on the order page.");
  }
  let redxArea = opts.redx;
  if (name === "redx" && !redxArea) {
    redxArea = (await autoRedx(o.addressDistrict, o.addressArea).catch(() => null)) ?? undefined;
    if (!redxArea)
      throw await fail("its delivery area couldn't be matched. Choose it on the order page.");
  }

  const input: ShipmentInput = {
    reference,
    recipient: {
      name: o.customerName,
      phone: o.customerPhone,
      address: o.addressStreet,
      district: o.addressDistrict,
      area: o.addressArea,
    },
    codAmount,
    declaredValue: o.total,
    items,
    pathao: pathaoPlace,
    redx: redxArea,
    manual: opts.manual,
  };
  let created;
  try {
    created = await provider.createShipment(input);
  } catch (e) {
    throw await fail(e instanceof Error ? e.message : String(e));
  }

  await withTx(async (tx) => {
    await tx
      .update(shipments)
      .set({
        consignmentId: created.consignmentId,
        trackingCode: created.trackingCode,
        status: created.status,
        raw: withRaw(null, "create", {
          request: { ...input, recipient: undefined },
          response: created.raw,
        }),
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shipments.id, shipmentId));
    await tx
      .update(orders)
      .set({ courier: name, trackingCode: created.trackingCode, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    if (o.status === "confirmed")
      await transitionOrder(tx, orderId, "packed", { actor: `admin:${admin.id}`, admin });
    await addEvent(tx, orderId, {
      type: "courier",
      actor: `admin:${admin.id}`,
      message: `Sent to ${label}: consignment ${created.consignmentId}${
        created.trackingCode !== created.consignmentId ? `, tracking ${created.trackingCode}` : ""
      }. ${codAmount ? `Cash to collect: ${formatPrice(codAmount)}.` : "Paid online: nothing to collect."}`,
    });
    await audit(tx, admin, "shipment.create", {
      entity: "order",
      entityId: o.number,
      after: { courier: name, consignmentId: created.consignmentId, codAmount },
    });
  });
  await applyCourierStatus(shipmentId, created.status, "create");
  return { shipmentId, consignmentId: created.consignmentId, trackingCode: created.trackingCode };
}

/** Sends several orders with one courier. Those that can't go are listed with the reason. */
export async function sendMany(ids: number[], name: CourierName | undefined, admin: Actor) {
  let sent = 0;
  const skipped: string[] = [];
  for (const id of ids) {
    try {
      await sendToCourier(id, { courier: name }, admin);
      sent++;
    } catch (e) {
      skipped.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { sent, skipped };
}

/**
 * A status from the courier, applied: the shipment records it, and the order moves to the state
 * it means (through any steps in between). A repeat or a step backwards changes nothing.
 */
export async function applyCourierStatus(
  shipmentId: number,
  status: string,
  source: "create" | "webhook" | "poll" | "simulate" | "manual",
  message?: string | null,
) {
  const s0 = await poolDb().select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
  const provider = s0[0] ? await courier(s0[0].courier) : null;
  if (!s0[0] || !provider) return { changed: false };
  const mapped = provider.map(status);

  return withTx(async (tx) => {
    const [s] = await tx.select().from(shipments).where(eq(shipments.id, shipmentId)).for("update");
    if (!s) return { changed: false };
    const label = shipmentLabel(s);
    const same = s.status === status && source !== "create";
    const [o] = await tx.select().from(orders).where(eq(orders.id, s.orderId)).for("update");
    const steps = o && mapped.order ? pathTo(o.status, mapped.order) : [];
    // Repeated, or out of date (an "in transit" arriving after "delivered"): note it, change nothing
    if (same || steps === null || (!s.active && source !== "create")) {
      await tx
        .update(shipments)
        .set({
          lastCheckedAt: new Date(),
          ...(same ? {} : { raw: withRaw(s.raw, `${source}-ignored`, { status, message }) }),
        })
        .where(eq(shipments.id, s.id));
      return { changed: false };
    }
    await tx
      .update(shipments)
      .set({
        status,
        active: !mapped.final,
        attempts: mapped.failedAttempt ? s.attempts + 1 : s.attempts,
        raw: withRaw(s.raw, source, { status, message }),
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shipments.id, s.id));
    if (source !== "create")
      await addEvent(tx, s.orderId, {
        type: "courier",
        actor: "courier",
        message: `${label}: ${mapped.label}.${message ? ` ${message}` : ""}`,
        data: { status, source },
      });
    if (mapped.attention)
      await addEvent(tx, s.orderId, {
        type: "attention",
        actor: "courier",
        message: mapped.attention,
      });
    for (const step of steps)
      await transitionOrder(tx, s.orderId, step, {
        actor: "courier",
        note: step === mapped.order ? `${label} reports: ${mapped.label}.` : undefined,
      });
    return { changed: true };
  });
}

/** A courier's webhook, end to end. Returns the HTTP status to answer with. */
export async function handleCourierWebhook(
  name: string,
  headers: Headers,
  body: unknown,
  url?: URL,
) {
  const provider = await courier(name);
  if (!provider) return 404;
  const ev = provider.handleWebhook(headers, body, url);
  if (!ev) return 401;
  if (!ev.consignmentId) return 200;
  if (!(await firstDelivery(`${name}-webhook`, ev.eventId))) return 200;
  const [s] = await poolDb()
    .select()
    .from(shipments)
    .where(
      and(
        eq(shipments.courier, name as CourierName),
        eq(shipments.consignmentId, ev.consignmentId),
      ),
    )
    .orderBy(desc(shipments.id))
    .limit(1);
  if (!s) return 200;
  // Trust the courier's API over the payload where it has one
  let status = ev.status;
  try {
    status = (await provider.getStatus(ev.consignmentId, s.trackingCode)) ?? status;
  } catch {
    /* the API can't be reached: the authenticated payload stands */
  }
  if (status) await applyCourierStatus(s.id, status, "webhook", ev.message);
  else if (ev.message)
    await withTx((tx) =>
      addEvent(tx, s.orderId, {
        type: "courier",
        actor: "courier",
        message: `${shipmentLabel(s)}: ${ev.message}`,
      }),
    );
  return 200;
}

/** The test courier: the admin sends an update, as a signed webhook through the real code path */
export async function simulateCourier(shipmentId: number, status: MockStatus) {
  const [s] = await poolDb().select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
  if (!s || s.courier !== "mock" || !s.consignmentId)
    throw new UserFacingError("Only test-courier parcels can be moved by hand.");
  const code = await handleCourierWebhook(
    "mock",
    new Headers(),
    mockWebhook(s.consignmentId, status),
  );
  if (code !== 200) throw new UserFacingError("The test courier is off on this site.");
}

/**
 * Another courier (or the team's rider): the team records what happened, through the same code a
 * real courier's update takes. Who did it goes in the activity log.
 */
export async function recordManualStatus(shipmentId: number, status: ManualStatus, admin: Actor) {
  const [s] = await poolDb().select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
  if (!s || s.courier !== "manual")
    throw new UserFacingError("Only parcels sent with another courier are moved by hand.");
  const r = await applyCourierStatus(s.id, status, "manual", `Recorded by ${admin.email}.`);
  if (r.changed)
    await audit(poolDb(), admin, "shipment.manual-status", {
      entity: "order",
      entityId: s.orderId,
      after: { status, consignmentId: s.consignmentId },
    });
  return r;
}

/** Asks each courier about its parcels still under way (cron, every 30 minutes) */
export async function pollShipments() {
  const due = await poolDb()
    .select()
    .from(shipments)
    .where(
      and(
        eq(shipments.active, true),
        sql`${shipments.consignmentId} is not null`,
        or(
          isNull(shipments.lastCheckedAt),
          lt(shipments.lastCheckedAt, sql`now() - interval '25 minutes'`),
        ),
      ),
    )
    .orderBy(asc(shipments.lastCheckedAt))
    .limit(100);
  let changed = 0;
  for (const s of due) {
    const provider = await courier(s.courier);
    try {
      const status = provider ? await provider.getStatus(s.consignmentId!, s.trackingCode) : null;
      if (status) {
        if ((await applyCourierStatus(s.id, status, "poll")).changed) changed++;
      } else
        await poolDb()
          .update(shipments)
          .set({ lastCheckedAt: new Date() })
          .where(eq(shipments.id, s.id));
    } catch (e) {
      console.error(`[shipping] poll ${s.courier} ${s.consignmentId}:`, (e as Error).message);
    }
  }
  return changed;
}

/**
 * Takes a parcel off the courier before pickup. Pathao and Steadfast cancel in their own panels:
 * confirm that it's done there, and it is recorded here. The order stays packed, ready to send again.
 */
export async function cancelShipment(shipmentId: number, confirmed: boolean, admin: Actor) {
  const [s] = await poolDb().select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
  if (!s || !s.active) throw new UserFacingError("That parcel is no longer under way.");
  const [o] = await poolDb().select().from(orders).where(eq(orders.id, s.orderId)).limit(1);
  if (o?.status !== "packed")
    throw new UserFacingError(
      "The courier has it already: it can only be cancelled before pickup.",
    );
  const provider = await courier(s.courier);
  const r = provider && s.consignmentId ? await provider.cancelShipment(s.consignmentId) : null;
  if (!r?.ok && !confirmed)
    throw new UserFacingError(r?.message ?? "Cancel it with the courier first.");
  await withTx(async (tx) => {
    await tx
      .update(shipments)
      .set({
        active: false,
        status: CANCELLED_HERE,
        updatedAt: new Date(),
        raw: withRaw(s.raw, "cancel", { by: admin.email }),
      })
      .where(eq(shipments.id, s.id));
    await tx
      .update(orders)
      .set({ courier: null, trackingCode: null, updatedAt: new Date() })
      .where(eq(orders.id, s.orderId));
    await addEvent(tx, s.orderId, {
      type: "courier",
      actor: `admin:${admin.id}`,
      message: `Parcel ${s.consignmentId} cancelled with ${shipmentLabel(s)}. Ready to send again.`,
    });
    await audit(tx, admin, "shipment.cancel", {
      entity: "order",
      entityId: o.number,
      before: { courier: s.courier, consignmentId: s.consignmentId },
    });
  });
}

export { RETURN_CONDITIONS, type ReturnCondition } from "./returns-meta";

/** A parcel came back: the order is returned, with a record of why and what state it is in */
export async function recordReturn(
  orderId: number,
  r: { reason: string; condition: ReturnCondition; restock: boolean },
  admin: Actor,
) {
  await withTx(async (tx) => {
    const items = await tx
      .select({ id: orderItems.id, qty: orderItems.qty })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    const restock = r.restock && r.condition !== "missing";
    await transitionOrder(tx, orderId, "returned", {
      actor: `admin:${admin.id}`,
      admin,
      restock,
      note: `${r.reason} Condition: ${r.condition}.`,
    });
    await tx.insert(returns).values({
      orderId,
      items: items.map((i) => ({ orderItemId: i.id, qty: i.qty })),
      reason: r.reason,
      condition: r.condition,
      restocked: restock,
      createdBy: admin.id,
    });
    await tx
      .update(shipments)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(shipments.orderId, orderId), eq(shipments.active, true)));
  });
  await revalidateStorefront();
}

export { orderTracking } from "./tracking-query";

export async function orderShipments(orderId: number) {
  return poolDb()
    .select()
    .from(shipments)
    .where(eq(shipments.orderId, orderId))
    .orderBy(desc(shipments.id));
}

export type { ShipmentRow };
