"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/auth/session";
import { courier } from "@/server/shipping/couriers";
import { MOCK_STEPS } from "@/server/shipping/mock";
import { MANUAL_STEPS, type ManualStatus } from "@/server/shipping/manual";
import { COURIER_NAMES } from "@/server/shipping/types";
import {
  RETURN_CONDITIONS,
  applyCourierStatus,
  cancelShipment,
  pathaoPlaces,
  recordManualStatus,
  recordReturn,
  redxPlaces,
  sendMany,
  sendToCourier,
  simulateCourier,
} from "@/server/shipping/service";
import { UserFacingError } from "@/server/errors";
import { poolDb } from "@/server/db/pool";
import { shipments } from "@/db/schema";
import { eq } from "drizzle-orm";

const id = z.number().int().positive();
const courierName = z.enum(COURIER_NAMES);
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
        redx: z
          .object({ areaId: id, areaName: z.string().trim().min(1).max(120) })
          .strict()
          .optional(),
        manual: z
          .object({
            courierName: z.string().trim().min(2, "Say which courier takes it.").max(60),
            trackingCode: z.string().trim().max(60).nullable(),
            trackingUrl: z
              .string()
              .trim()
              .max(300)
              .refine(
                (u) => !u || /^https:\/\/[^\s]+$/.test(u),
                "The tracking link must start with https://",
              )
              .nullable(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    input,
    async (d, admin) => {
      const r = await sendToCourier(
        d.id,
        { courier: d.courier, pathao: d.pathao, redx: d.redx, manual: d.manual },
        admin.actor,
      );
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

export async function redxPlacesAction(input: unknown) {
  return runAction("shipping.manage", z.object({ orderId: id }).strict(), input, async (d) =>
    redxPlaces(d.orderId),
  );
}

/** Another courier (or the team's rider): the team records what happened */
export async function manualStatusAction(input: unknown) {
  return runAction(
    "shipping.manage",
    z.object({ shipmentId: id, status: z.enum(MANUAL_STEPS as [string, ...string[]]) }).strict(),
    input,
    async (d, admin) => {
      const r = await recordManualStatus(d.shipmentId, d.status as ManualStatus, admin.actor);
      refresh();
      return r;
    },
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
    const provider = s ? await courier(s.courier) : null;
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
