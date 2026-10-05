import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { adminUsers } from "./admin";
import { discoverySets, fragrances, variants } from "./catalogue";

const ts = (name: string) => timestamp(name, { withTimezone: true });
/** Money: integer poisha (1 taka = 100 poisha), BDT only */
const money = (name: string) => integer(name).notNull().default(0);

/* ---------------------------------------------------------------------------------------------- */
/* Enums: the order state machine lives in src/server/orders/state.ts                              */

export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "delivery_failed",
  "return_requested",
  "returned",
]);
export const paymentStatus = pgEnum("payment_status", [
  "unpaid",
  "paid",
  "failed",
  "partially_refunded",
  "refunded",
]);
export const paymentMethod = pgEnum("payment_method", ["sslcommerz", "cod", "manual"]);
export const shippingZone = pgEnum("shipping_zone", ["inside_dhaka", "outside_dhaka"]);
export const courierName = pgEnum("courier_name", [
  "mock",
  "pathao",
  "steadfast",
  "redx",
  "manual",
  "carrybee",
]);
export const stockMovementType = pgEnum("stock_movement_type", [
  "initial",
  "sale",
  "cancel_restock",
  "return_restock",
  "manual_adjustment",
]);
export const paymentRecordStatus = pgEnum("payment_record_status", [
  "initiated",
  "paid",
  "failed",
  "cancelled",
]);
export const refundStatus = pgEnum("refund_status", ["pending", "completed", "failed"]);

/* ---------------------------------------------------------------------------------------------- */
/* Stock                                                                                           */

/** The stock ledger: every change to a size's stock is one row. `variants.stock` always equals the
 *  sum of `delta` for that variant (checked by `npm run stock:check`). */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    type: stockMovementType("type").notNull(),
    delta: integer("delta").notNull(),
    reason: text("reason"),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    adminUserId: text("admin_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("stock_movements_variant_idx").on(t.variantId, t.createdAt),
    index("stock_movements_order_idx").on(t.orderId),
  ],
);

/** Stock held for an unpaid online-payment order; released on payment, cancellation or expiry */
export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull(),
    expiresAt: ts("expires_at").notNull(),
    releasedAt: ts("released_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("stock_reservations_active_idx")
      .on(t.variantId)
      .where(sql`${t.releasedAt} is null`),
    index("stock_reservations_order_idx").on(t.orderId),
  ],
);

/* ---------------------------------------------------------------------------------------------- */
/* Customers (guests, identified by a verified phone number)                                       */

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  /** Normalised Bangladeshi mobile number, 01XXXXXXXXX */
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    district: text("district").notNull(),
    area: text("area").notNull(),
    street: text("street").notNull(),
    zone: shippingZone("zone").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("customer_addresses_customer_idx").on(t.customerId)],
);

/** One-time codes sent by SMS. Only a hash of the code is stored. */
export const phoneOtps = pgTable(
  "phone_otps",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    verifiedAt: ts("verified_at"),
    ip: text("ip"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("phone_otps_phone_idx").on(t.phone, t.createdAt)],
);

/** A phone verified in one browser: a signed cookie carries the token, this table its hash (24h) */
export const phoneVerifications = pgTable(
  "phone_verifications",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("phone_verifications_token_idx").on(t.tokenHash)],
);

/* ---------------------------------------------------------------------------------------------- */
/* Coupons                                                                                         */

export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    /** Stored upper-case; matched case-insensitively */
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
    active: boolean("active").notNull().default(true),
    /** 1–100 */
    percentOff: integer("percent_off"),
    /** Cap on a percentage discount, poisha */
    maxDiscount: integer("max_discount"),
    /** Fixed amount off, poisha */
    amountOff: integer("amount_off"),
    freeShipping: boolean("free_shipping").notNull().default(false),
    /** Minimum subtotal, poisha */
    minSubtotal: integer("min_subtotal"),
    firstOrderOnly: boolean("first_order_only").notNull().default(false),
    usageLimit: integer("usage_limit"),
    perCustomerLimit: integer("per_customer_limit"),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    /** Empty = every fragrance / every size */
    fragranceIds: integer("fragrance_ids")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    variantIds: integer("variant_ids")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("coupons_code_idx").on(sql`upper(${t.code})`),
    check(
      "coupons_percent_range",
      sql`${t.percentOff} is null or ${t.percentOff} between 1 and 100`,
    ),
  ],
);

/* ---------------------------------------------------------------------------------------------- */
/* Orders                                                                                          */

/** Human-friendly order numbers: ZLF-000123 */
export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 1001 });

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    number: text("number")
      .notNull()
      .default(sql`'ZLF-' || lpad(nextval('order_number_seq')::text, 6, '0')`),
    /** Sent by the checkout; the same key never creates a second order */
    idempotencyKey: text("idempotency_key").notNull(),
    /** Lets the customer's browser open its own confirmation page (never shown in the admin) */
    accessToken: text("access_token").notNull(),

    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email").notNull(),
    addressDistrict: text("address_district").notNull(),
    addressArea: text("address_area").notNull(),
    addressStreet: text("address_street").notNull(),
    zone: shippingZone("zone").notNull(),

    subtotal: money("subtotal"),
    discount: money("discount"),
    shippingFee: money("shipping_fee"),
    total: money("total"),
    couponId: integer("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
    couponCode: text("coupon_code"),

    paymentMethod: paymentMethod("payment_method").notNull(),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    status: orderStatus("status").notNull().default("pending_payment"),
    courier: courierName("courier"),
    trackingCode: text("tracking_code"),
    internalNotes: text("internal_notes").notNull().default(""),

    /** Unpaid online-payment orders lapse at this time (their reserved stock is released) */
    expiresAt: ts("expires_at"),
    confirmedAt: ts("confirmed_at"),
    packedAt: ts("packed_at"),
    shippedAt: ts("shipped_at"),
    outForDeliveryAt: ts("out_for_delivery_at"),
    deliveredAt: ts("delivered_at"),
    cancelledAt: ts("cancelled_at"),
    deliveryFailedAt: ts("delivery_failed_at"),
    returnRequestedAt: ts("return_requested_at"),
    returnedAt: ts("returned_at"),
    receiptSentAt: ts("receipt_sent_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.number),
    uniqueIndex("orders_idempotency_idx").on(t.idempotencyKey),
    uniqueIndex("orders_access_token_idx").on(t.accessToken),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
    index("orders_customer_idx").on(t.customerId),
    index("orders_phone_idx").on(t.customerPhone),
    check("orders_total_nonnegative", sql`${t.total} >= 0`),
  ],
);

/** Line items: a snapshot of what was bought, at the price paid */
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
    fragranceId: integer("fragrance_id").references(() => fragrances.id, { onDelete: "set null" }),
    setId: integer("set_id").references(() => discoverySets.id, { onDelete: "set null" }),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    sizeMl: integer("size_ml").notNull(),
    /** Vials in the pack (3 for a discovery set), so the line reads "3 × 3 ml" */
    pieces: integer("pieces").notNull().default(1),
    unitPrice: money("unit_price"),
    qty: integer("qty").notNull(),
    lineTotal: money("line_total"),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_variant_idx").on(t.variantId),
  ],
);

/** The order's timeline: status changes, payments, courier updates, notes and admin actions */
export const orderEvents = pgTable(
  "order_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    message: text("message").notNull().default(""),
    data: jsonb("data"),
    /** system | customer | payment | courier | admin:<user id> */
    actor: text("actor").notNull().default("system"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);

/* ---------------------------------------------------------------------------------------------- */
/* Payments, refunds, returns                                                                      */

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** mock | sslcommerz | cod */
    provider: text("provider").notNull(),
    /** Our transaction ID, sent to the provider */
    tranId: text("tran_id").notNull(),
    /** The provider's validation ID (SSLCommerz val_id) */
    valId: text("val_id"),
    amount: money("amount"),
    status: paymentRecordStatus("status").notNull().default("initiated"),
    /** As the provider reports it: VISA, bKash, Nagad, … */
    methodReported: text("method_reported"),
    validation: jsonb("validation"),
    /** Raw provider payloads, for auditing (owner only) */
    raw: jsonb("raw"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payments_tran_idx").on(t.tranId), index("payments_order_idx").on(t.orderId)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentId: integer("payment_id").references(() => payments.id, { onDelete: "set null" }),
    amount: money("amount"),
    reason: text("reason").notNull(),
    providerRef: text("provider_ref"),
    status: refundStatus("status").notNull().default("pending"),
    issuedBy: text("issued_by").references(() => adminUsers.id, { onDelete: "set null" }),
    raw: jsonb("raw"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("refunds_order_idx").on(t.orderId)],
);

export const returns = pgTable(
  "returns",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** [{ orderItemId, qty }] */
    items: jsonb("items").$type<{ orderItemId: number; qty: number }[]>().notNull(),
    reason: text("reason").notNull(),
    condition: text("condition").notNull().default(""),
    restocked: boolean("restocked").notNull().default(false),
    createdBy: text("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("returns_order_idx").on(t.orderId)],
);

/* ---------------------------------------------------------------------------------------------- */
/* Shipping                                                                                        */

export const shipments = pgTable(
  "shipments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    courier: courierName("courier").notNull(),
    consignmentId: text("consignment_id"),
    trackingCode: text("tracking_code"),
    /** The courier's own status, as last reported (mapped to order states per courier) */
    status: text("status").notNull().default("created"),
    codAmount: money("cod_amount"),
    labelUrl: text("label_url"),
    attempts: integer("attempts").notNull().default(0),
    raw: jsonb("raw"),
    active: boolean("active").notNull().default(true),
    lastCheckedAt: ts("last_checked_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("shipments_order_idx").on(t.orderId),
    index("shipments_consignment_idx").on(t.courier, t.consignmentId),
  ],
);

/** Every provider callback (payment IPN, courier webhook), so a repeat changes nothing */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    receivedAt: ts("received_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webhook_events_unique_idx").on(t.provider, t.eventId)],
);
