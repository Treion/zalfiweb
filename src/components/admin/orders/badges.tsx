import { Badge } from "@/components/admin/ui/badge";
import {
  PAYMENT_STATUS_LABELS,
  STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/server/orders/state";

type Tone = "neutral" | "info" | "progress" | "success" | "warning" | "danger";

/** One colour per status, everywhere in the admin */
export const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending_payment: "warning",
  confirmed: "info",
  packed: "progress",
  shipped: "progress",
  out_for_delivery: "progress",
  delivered: "success",
  cancelled: "neutral",
  delivery_failed: "danger",
  return_requested: "warning",
  returned: "neutral",
};

export const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  unpaid: "neutral",
  paid: "success",
  failed: "danger",
  partially_refunded: "warning",
  refunded: "neutral",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function PaymentBadge({ status, cod }: { status: PaymentStatus; cod?: boolean }) {
  if (cod && status === "unpaid") return <Badge variant="neutral">Cash on delivery</Badge>;
  return <Badge variant={PAYMENT_TONE[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}
