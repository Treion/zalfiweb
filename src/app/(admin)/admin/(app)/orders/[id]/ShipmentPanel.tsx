import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Badge } from "@/components/admin/ui/badge";
import { formatPrice } from "@/lib/money";
import { formatRelative } from "@/lib/time";
import type { OrderRow } from "@/server/orders/manage";
import type { CourierOption } from "@/server/shipping/couriers";
import { trackingUrl } from "@/server/shipping/tracking";
import { mapStatus } from "@/server/shipping/status";
import { COURIER_LABELS } from "@/server/shipping/types";
import type { ShipmentRow } from "@/server/shipping/service";
import { codAmountFor } from "@/server/shipping/service";
import { SendToCourier, ShipmentActions } from "./ShipmentControls";

/** The order's parcel: send it, follow it, print its label. Earlier parcels are listed below. */
export function ShipmentPanel({
  order: o,
  shipments,
  couriers,
  defaultCourier,
  canManage,
  receiptSentAt,
}: {
  order: OrderRow;
  shipments: ShipmentRow[];
  couriers: CourierOption[];
  defaultCourier: string;
  canManage: boolean;
  receiptSentAt: Date | null;
}) {
  const current =
    shipments.find((s) => s.active) ?? shipments.find((s) => s.status !== "cancelled");
  const sendable = !shipments.some((s) => s.active) && ["confirmed", "packed"].includes(o.status);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipment</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {current ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{COURIER_LABELS[current.courier]}</span>
              <Badge
                variant={
                  current.active
                    ? "progress"
                    : mapStatus(current.courier, current.status).order === "delivered"
                      ? "success"
                      : "neutral"
                }
              >
                {mapStatus(current.courier, current.status).label}
              </Badge>
            </div>
            <Line label="Consignment" value={current.consignmentId ?? "—"} mono />
            {current.trackingCode && current.trackingCode !== current.consignmentId && (
              <Line label="Tracking" value={current.trackingCode} mono />
            )}
            <Line
              label={
                current.active
                  ? "Cash to collect"
                  : mapStatus(current.courier, current.status).order === "delivered"
                    ? "Cash collected"
                    : "Cash on delivery"
              }
              value={current.codAmount ? formatPrice(current.codAmount) : "Nothing (paid)"}
            />
            {current.attempts > 0 && (
              <Line label="Failed attempts" value={String(current.attempts)} />
            )}
            <p className="text-muted-foreground text-xs">
              {current.lastCheckedAt
                ? `Last news ${formatRelative(current.lastCheckedAt)}`
                : "No news yet"}
              {(() => {
                const url = trackingUrl(current.courier, current.trackingCode, o.customerPhone);
                return url ? (
                  <>
                    {" · "}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      Tracking page
                    </a>
                  </>
                ) : null;
              })()}
            </p>
            {canManage && current.consignmentId && (
              <ShipmentActions
                orderId={o.id}
                shipmentId={current.id}
                mock={current.courier === "mock"}
                underWay={current.active}
                canCancel={current.active && o.status === "packed"}
                courierLabel={COURIER_LABELS[current.courier]}
              />
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            {o.status === "pending_payment"
              ? "Not yet: the order is waiting for payment."
              : sendable
                ? "Not with a courier yet."
                : "This order wasn't sent with a courier."}
          </p>
        )}
        {canManage && sendable && (
          <div className="mt-1">
            <SendToCourier
              orderId={o.id}
              number={o.number}
              couriers={couriers}
              defaultCourier={defaultCourier}
              cod={codAmountFor(o)}
            />
          </div>
        )}
        {shipments.filter((s) => s !== current).length > 0 && (
          <div className="mt-2 border-t pt-2">
            <p className="text-muted-foreground mb-1 text-xs font-medium">Earlier parcels</p>
            {shipments
              .filter((s) => s !== current)
              .map((s) => (
                <p key={s.id} className="text-muted-foreground text-xs">
                  {`${COURIER_LABELS[s.courier]} ${s.consignmentId ?? ""} · ${mapStatus(s.courier, s.status).label}`}
                </p>
              ))}
          </div>
        )}
        {receiptSentAt && (
          <p className="text-muted-foreground mt-2 border-t pt-2 text-xs">
            E-receipt sent {formatRelative(receiptSentAt)}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Line({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${mono ? "font-mono text-xs" : "tabular-nums"}`}>{value}</span>
    </div>
  );
}
