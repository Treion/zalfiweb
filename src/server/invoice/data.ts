import { asc, eq } from "drizzle-orm";
import { orderItems, orders } from "@/db/schema";
import { PAYMENT_LABELS } from "@/lib/checkout";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDate } from "@/lib/time";
import { siteUrl } from "@/lib/env";
import { poolDb, type Executor } from "@/server/db/pool";
import { getSettings } from "@/server/settings";
import { includedVat } from "@/server/checkout/pricing";
import { PAYMENT_STATUS_LABELS } from "@/server/orders/state";
import { orderTracking } from "@/server/shipping/tracking-query";
import { sizeLabel } from "@/lib/size";

/**
 * Everything a receipt or invoice shows, already worded and formatted. The e-receipt email and the
 * PDF invoice both render this one object, in the same order, so they always match. The invoice
 * number is the order number.
 */
export type InvoiceData = {
  number: string;
  date: string;
  store: { name: string; phone: string; email: string; address: string; url: string };
  /** Business details from Settings → Invoice; only the filled-in ones */
  business: { label: string; value: string }[];
  businessName: string;
  businessAddress: string;
  customer: { name: string; phone: string; email: string };
  address: string[];
  items: { name: string; size: string; qty: number; unit: string; total: string }[];
  totals: { label: string; value: string; strong?: boolean }[];
  payment: { method: string; status: string };
  trackingUrl: string | null;
  /** The free gift note, printed on a card in the box (null: not a gift) */
  giftMessage: string | null;
  footerNote: string;
};

const ZONE_LABEL = { inside_dhaka: "Inside Dhaka", outside_dhaka: "Outside Dhaka" } as const;

export async function loadInvoice(orderId: number, exec: Executor = poolDb()) {
  const [o] = await exec.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) return null;
  const [items, store, inv] = await Promise.all([
    exec
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.id)),
    getSettings("store", exec),
    getSettings("invoice", exec),
  ]);

  const totals: InvoiceData["totals"] = [{ label: "Subtotal", value: formatPrice(o.subtotal) }];
  if (o.discount > 0)
    totals.push({
      label: o.couponCode ? `Discount (${o.couponCode})` : "Discount",
      value: formatPrice(-o.discount),
    });
  totals.push({
    label: `Shipping (${ZONE_LABEL[o.zone]})`,
    value: o.shippingFee ? formatPrice(o.shippingFee) : "Free",
  });
  totals.push({ label: "Total", value: formatPrice(o.total), strong: true });
  if (inv.vatEnabled && inv.vatRate > 0)
    totals.push({
      label: `Includes VAT (${inv.vatRate}%)`,
      value: formatPrice(includedVat(o.total, inv.vatRate)),
    });

  const business = [
    inv.tradeLicence && { label: "Trade licence", value: inv.tradeLicence },
    inv.bin && { label: "BIN", value: inv.bin },
  ].filter((x): x is { label: string; value: string } => !!x);

  const data: InvoiceData = {
    number: o.number,
    date: formatDate(o.confirmedAt ?? o.createdAt),
    store: {
      name: store.name,
      phone: store.contactPhone,
      email: store.email,
      address: store.address,
      url: siteUrl(),
    },
    business,
    businessName: inv.businessName || store.name,
    businessAddress: inv.address || store.address,
    customer: { name: o.customerName, phone: formatPhone(o.customerPhone), email: o.customerEmail },
    address: [o.addressStreet, `${o.addressArea}, ${o.addressDistrict}`, ZONE_LABEL[o.zone]],
    items: items.map((i) => ({
      name: i.name,
      size: sizeLabel(i.sizeMl, i.pieces),
      qty: i.qty,
      unit: formatPrice(i.unitPrice),
      total: formatPrice(i.lineTotal),
    })),
    totals,
    payment: {
      method: PAYMENT_LABELS[o.paymentMethod],
      status:
        o.paymentMethod === "cod" && o.paymentStatus === "unpaid"
          ? "Pay on delivery"
          : PAYMENT_STATUS_LABELS[o.paymentStatus],
    },
    trackingUrl: (await orderTracking(o.id, exec))?.url ?? null,
    giftMessage: o.giftMessage,
    footerNote: inv.footerNote,
  };
  return { order: o, data };
}
