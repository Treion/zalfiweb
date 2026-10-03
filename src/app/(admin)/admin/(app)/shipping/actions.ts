"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/auth/session";
import { courier } from "@/server/shipping/couriers";
import { MOCK_STEPS } from "@/server/shipping/mock";
import {
  RETURN_CONDITIONS,
  applyCourierStatus,
  cancelShipment,
  pathaoPlaces,
  recordReturn,
  sendMany,
  sendToCourier,
  simulateCourier,
} from "@/server/shipping/service";
import { UserFacingError } from "@/server/errors";
import { poolDb } from "@/server/db/pool";
import { shipments } from "@/db/schema";
import { eq } from "drizzle-orm";

const id = z.number().int().positive();
const courierName = z.enum(["mock", "pathao", "steadfast"]);
const refresh = () => revalidatePath("/admin", "layout");

export async function sendToCourierAction(input: unknown) {
  return runAction(
    "shipping.manage",
    z
      .object({
        id,
        courier: courierName.optional(),
        pathao: z
          .object({ cityId: id, zoneId: id, areaId: id.nullable().optional() })
          .strict()
          .optional(),
      })
      .strict(),
    input,
    async (d, admin) => {
      const r = await sendToCourier(d.id, { courier: d.courier, pathao: d.pathao }, admin.actor);
      refresh();
      return r;
    },
  );
}

export async function sendManyAction(input: unknown) {
  return runAction(
    "shipping.manage",
    z.object({ ids: z.array(id).min(1).max(100), courier: courierName.optional() }).strict(),
    input,
    async (d, admin) => {
      const r = await sendMany(d.ids, d.courier, admin.actor);
      refresh();
      return r;
    },
  );
}

export async function pathaoPlacesAction(input: unknown) {
  return runAction(
    "shipping.manage",
    z.object({ orderId: id, cityId: id.optional() }).strict(),
    input,
    async (d) => pathaoPlaces(d.orderId, d.cityId),
  );
}

export async function simulateCourierAction(input: unknown) {
  return runAction(
    "shipping.manage",
    z.object({ shipmentId: id, status: z.enum(MOCK_STEPS as [string, ...string[]]) }).strict(),
    input,
    async (d) => {
      await simulateCourier(d.shipmentId, d.status as (typeof MOCK_STEPS)[number]);
      refresh();
    },
  );
}

/** Asks the courier for the parcel's status now */
export async function refreshShipmentAction(input: unknown) {
  return runAction("shipping.manage", z.object({ shipmentId: id }).strict(), input, async (d) => {
    const [s] = await poolDb().select().from(shipments).where(eq(shipments.id, d.shipmentId));
    const provider = s ? courier(s.courier) : null;
    if (!s || !provider || !s.consignmentId)
      throw new UserFacingError("That courier isn't set up.");
    const status = await provider.getStatus(s.consignmentId, s.trackingCode);
    if (!status) return { changed: false, status: s.status };
    const r = await applyCourierStatus(s.id, status, "poll");
    refresh();
    return { changed: r.changed, status };
  });
}

export async function cancelShipmentAction(input: unknown) {
  return runAction(
    "shipping.manage",
    z.object({ shipmentId: id, confirmed: z.boolean() }).strict(),
    input,
    async (d, admin) => {
      await cancelShipment(d.shipmentId, d.confirmed, admin.actor);
      refresh();
    },
  );
}

export async function returnOrderAction(input: unknown) {
  return runAction(
    "orders.manage",
    z
      .object({
        id,
        reason: z.string().trim().min(3, "Add why it came back.").max(300),
        condition: z.enum(RETURN_CONDITIONS),
        restock: z.boolean(),
      })
      .strict(),
    input,
    async (d, admin) => {
      await recordReturn(d.id, d, admin.actor);
      refresh();
    },
  );
}
