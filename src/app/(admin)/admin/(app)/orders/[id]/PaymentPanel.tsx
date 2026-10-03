import { PaymentBadge } from "@/components/admin/orders/badges";
import { AttemptBadge, RefundBadge, gatewayLabel } from "@/components/admin/orders/payment-badges";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { PAYMENT_LABELS } from "@/lib/checkout";
import { formatPrice } from "@/lib/money";
import { formatDateTime, formatRelative } from "@/lib/time";
import type { OrderRow } from "@/server/orders/manage";
import type { orderPayments } from "@/server/payments/admin-query";
import { RefreshRefund, RefundButton } from "./PaymentControls";

type Data = Awaited<ReturnType<typeof orderPayments>>;
type Validation = {
  accepted?: boolean;
  reason?: string;
  risky?: boolean;
  riskTitle?: string | null;
  bankTranId?: string | null;
  validatedAt?: string;
} | null;

/**
 * The order's money: method and status, every payment attempt (with how the provider validated
 * it), every refund, and the refund button. Raw provider payloads are for the owner only.
 */
export function PaymentPanel({
  order: o,
  data,
  canRefund,
  canManage,
  canSeeRaw,
}: {
  order: OrderRow;
  data: Data;
  canRefund: boolean;
  canManage: boolean;
  canSeeRaw: boolean;
}) {
  const { sum } = data;
  const cod = o.paymentMethod === "cod";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment</CardTitle>
        {canRefund && sum.left > 0 && (
          <CardAction>
            <RefundButton orderId={o.id} number={o.number} left={sum.left} manual={cod} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-sm">
        <Line label="Method" value={PAYMENT_LABELS[o.paymentMethod]} />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Status</span>
          <PaymentBadge status={o.paymentStatus} cod={cod} />
        </div>
        {cod && sum.paid === 0 ? (
          <Line label="To collect" value={formatPrice(o.total)} />
        ) : (
          <Line label="Paid" value={formatPrice(sum.paid)} />
        )}
        {sum.completed > 0 && <Line label="Refunded" value={formatPrice(-sum.completed)} />}
        {sum.pending > 0 && <Line label="Refund processing" value={formatPrice(sum.pending)} />}
        {cod && sum.paid === 0 && (
          <p className="text-muted-foreground mt-1 text-xs">
            Marked paid when the order is delivered.
          </p>
        )}

        {data.payments.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium">Attempts</p>
            <ul className="flex flex-col gap-3">
              {data.payments.map((p) => {
                const v = p.validation as Validation;
                return (
                  <li key={p.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{p.tranId}</span>
                      <AttemptBadge status={p.status} />
                    </div>
                    <div className="text-muted-foreground flex justify-between gap-2 text-xs">
                      <span>
                        {[gatewayLabel(p.provider), p.methodReported, formatRelative(p.createdAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="tabular-nums">{formatPrice(p.amount)}</span>
                    </div>
                    {v && (
                      <p className="text-muted-foreground text-xs">
                        {v.accepted
                          ? `Validated ${v.validatedAt ? formatDateTime(v.validatedAt) : ""}${v.bankTranId ? ` · bank ${v.bankTranId}` : ""}`
                          : `Not accepted: ${v.reason}`}
                      </p>
                    )}
                    {v?.risky && (
                      <p className="text-xs text-[var(--tone-warning-fg)]">
                        {`Flagged as risky${v.riskTitle ? `: ${v.riskTitle}` : ""}. Check before packing.`}
                      </p>
                    )}
                    {canSeeRaw && p.raw !== null && (
                      <details className="text-xs">
                        <summary className="text-muted-foreground cursor-pointer">
                          Provider data (owner only)
                        </summary>
                        <pre className="bg-muted mt-2 max-h-64 overflow-auto rounded-md p-2 text-[11px] leading-snug whitespace-pre-wrap">
                          {JSON.stringify(p.raw, null, 2)}
                        </pre>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {data.refunds.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium">Refunds</p>
            <ul className="flex flex-col gap-3">
              {data.refunds.map((r) => (
                <li key={r.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium tabular-nums">{formatPrice(r.amount)}</span>
                    <span className="flex items-center gap-1">
                      {r.status === "pending" && canManage && r.paymentId !== null && (
                        <RefreshRefund refundId={r.id} orderId={o.id} />
                      )}
                      <RefundBadge status={r.status} />
                    </span>
                  </div>
                  <p className="text-xs">{r.reason}</p>
                  <p className="text-muted-foreground text-xs">
                    {[
                      r.paymentId === null ? "Paid back by hand" : "Through the provider",
                      r.by,
                      formatRelative(r.createdAt),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}
