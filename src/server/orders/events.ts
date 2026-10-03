import { orderEvents } from "@/db/schema";
import type { Executor } from "@/server/db/pool";

/** Who an order event comes from: the system, the customer, a provider, or an admin */
export type EventActor = "system" | "customer" | "payment" | "courier" | `admin:${string}`;

/** One line on an order's timeline. Write it in the same transaction as the change it records. */
export async function addEvent(
  exec: Executor,
  orderId: number,
  e: {
    type: string;
    message?: string;
    from?: string | null;
    to?: string | null;
    data?: unknown;
    actor?: EventActor;
  },
) {
  await exec.insert(orderEvents).values({
    orderId,
    type: e.type,
    fromStatus: e.from ?? null,
    toStatus: e.to ?? null,
    message: e.message ?? "",
    data: e.data ?? null,
    actor: e.actor ?? "system",
  });
}
