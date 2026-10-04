import { Badge } from "@/components/admin/ui/badge";

/** Payment attempts and refunds, in the same tones as order statuses */
const ATTEMPT = {
  initiated: { label: "Started", tone: "neutral" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Abandoned", tone: "neutral" },
} as const;

const REFUND = {
  pending: { label: "Processing", tone: "warning" },
  completed: { label: "Refunded", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
} as const;

export function AttemptBadge({ status }: { status: keyof typeof ATTEMPT }) {
  const s = ATTEMPT[status];
  return <Badge variant={s.tone}>{s.label}</Badge>;
}

export function RefundBadge({ status }: { status: keyof typeof REFUND }) {
  const s = REFUND[status];
  return <Badge variant={s.tone}>{s.label}</Badge>;
}

export const ATTEMPT_LABELS = Object.fromEntries(
  Object.entries(ATTEMPT).map(([k, v]) => [k, v.label]),
) as Record<keyof typeof ATTEMPT, string>;
export const REFUND_LABELS = Object.fromEntries(
  Object.entries(REFUND).map(([k, v]) => [k, v.label]),
) as Record<keyof typeof REFUND, string>;

/** A payment record's gateway, in words */
export const gatewayLabel = (provider: string) =>
  (
    ({
      mock: "Test gateway",
      sslcommerz: "SSLCommerz",
      aamarpay: "aamarPay",
      manual: "By hand",
      cod: "Cash on delivery",
    }) as Record<string, string>
  )[provider] ?? provider;
