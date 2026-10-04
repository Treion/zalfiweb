import { describe, expect, it } from "vitest";
import { mapMock, MOCK_STATUSES } from "@/server/shipping/status-mock";
import { mapPathao, normalisePathao } from "@/server/shipping/status-pathao";
import { mapSteadfast } from "@/server/shipping/status-steadfast";
import { mapStatus } from "@/server/shipping/status";
import { matchPlace } from "@/server/shipping/pathao-geo";
import { parcelWeight, parseCreated, pathao, pathaoOrderBody } from "@/server/shipping/pathao";
import { parseSteadfastCreated, steadfast, steadfastOrderBody } from "@/server/shipping/steadfast";
import { mockCourier, mockWebhook } from "@/server/shipping/mock";
import { manualCourier } from "@/server/shipping/manual";
import { mapRedx } from "@/server/shipping/status-redx";
import { parseRedxCreated, redx, redxBase, redxParcelBody } from "@/server/shipping/redx";
import { trackingUrl } from "@/server/shipping/tracking";
import { codAmountFor, pathTo } from "@/server/shipping/service";
import { CANCELLED_HERE, type ShipmentInput } from "@/server/shipping/types";
import { ORDER_STATUSES, TRANSITIONS } from "@/server/orders/state";

const input: ShipmentInput = {
  reference: "ZLF-001234",
  recipient: {
    name: "Nusrat Jahan",
    phone: "01712345678",
    address: "Road 7A, House 21",
    district: "Dhaka",
    area: "Dhanmondi",
  },
  codAmount: 457_000,
  declaredValue: 457_000,
  items: [
    { name: "Reva", qty: 2 },
    { name: "Oudor", qty: 1 },
  ],
};

const pathaoCfg = {
  clientId: "id",
  clientSecret: "secret",
  username: "u@zalfi.test",
  password: "pw",
  storeId: "12345",
  live: false,
  webhookSecret: "pathao-hook-secret",
};

describe("status mappings", () => {
  it("map every test-courier status to a real order state (or none)", () => {
    for (const s of Object.keys(MOCK_STATUSES)) {
      const m = mapMock(s);
      expect(m.label).toBeTruthy();
      if (m.order) expect(ORDER_STATUSES).toContain(m.order);
    }
    expect(mapMock("delivered")).toMatchObject({ order: "delivered", final: true });
    expect(mapMock("delivery_failed")).toMatchObject({
      order: "delivery_failed",
      failedAttempt: true,
    });
  });

  it("read Pathao's slugs and webhook event names the same way", () => {
    expect(normalisePathao("order.picked")).toBe("picked");
    expect(normalisePathao("At_the_Sorting_HUB")).toBe("at_the_sorting_hub");
    expect(normalisePathao("Pickup Requested")).toBe("pickup_requested");
    expect(mapPathao("Delivered")).toMatchObject({ order: "delivered", final: true });
    expect(mapPathao("order.delivered")).toMatchObject({ order: "delivered" });
    expect(mapPathao("Assigned_for_Delivery").order).toBe("out_for_delivery");
    expect(mapPathao("order.in-transit").order).toBe("shipped");
    expect(mapPathao("Delivery_Failed")).toMatchObject({
      order: "delivery_failed",
      failedAttempt: true,
    });
    expect(mapPathao("Returned").attention).toBeTruthy();
  });

  it("map Steadfast's delivery statuses", () => {
    expect(mapSteadfast("in_review").order).toBe("packed");
    expect(mapSteadfast("pending").order).toBe("shipped");
    expect(mapSteadfast("delivered")).toMatchObject({ order: "delivered", final: true });
    expect(mapSteadfast("delivered_approval_pending")).toMatchObject({
      order: "delivered",
      final: false,
    });
    expect(mapSteadfast("cancelled")).toMatchObject({ order: "delivery_failed", final: true });
    expect(mapSteadfast("partial_delivered").attention).toBeTruthy();
  });

  it("never move an order on a status nobody knows", () => {
    for (const map of [mapMock, mapPathao, mapSteadfast]) {
      const m = map("something_new");
      expect(m.order).toBeNull();
      expect(m.final).toBe(false);
    }
  });

  it("tell a parcel cancelled here from a courier's own cancel", () => {
    expect(mapStatus("steadfast", CANCELLED_HERE)).toMatchObject({ order: null, final: true });
    expect(mapStatus("steadfast", "cancelled").order).toBe("delivery_failed");
    expect(mapStatus("pathao", "creating").label).toBe("Sending…");
  });
});

describe("pathTo", () => {
  it("walks the state machine, through the steps in between", () => {
    expect(pathTo("packed", "delivered")).toEqual(["shipped", "delivered"]);
    expect(pathTo("confirmed", "out_for_delivery")).toEqual([
      "packed",
      "shipped",
      "out_for_delivery",
    ]);
    expect(pathTo("delivery_failed", "delivered")).toEqual(["shipped", "delivered"]);
    expect(pathTo("shipped", "shipped")).toEqual([]);
  });

  it("refuses to go backwards or through a dead end", () => {
    expect(pathTo("delivered", "shipped")).toBeNull();
    expect(pathTo("out_for_delivery", "packed")).toBeNull();
    expect(pathTo("cancelled", "delivered")).toBeNull();
    expect(pathTo("returned", "delivered")).toBeNull();
    // Never through a cancel or a return on the way somewhere else
    for (const from of ORDER_STATUSES)
      for (const to of ORDER_STATUSES) {
        const path = pathTo(from, to);
        if (!path) continue;
        let at = from;
        for (const step of path) {
          expect(TRANSITIONS[at]).toContain(step);
          at = step;
        }
        expect(path.slice(0, -1)).not.toContain("cancelled");
        expect(path.slice(0, -1)).not.toContain("returned");
      }
  });
});

describe("matchPlace", () => {
  const cities = [
    { id: 1, name: "Dhaka" },
    { id: 2, name: "Chittagong" },
    { id: 3, name: "Comilla" },
    { id: 4, name: "Bogra" },
    { id: 5, name: "Cox's Bazar" },
  ];
  it("matches our spellings to Pathao's", () => {
    expect(matchPlace(cities, "Dhaka")?.id).toBe(1);
    expect(matchPlace(cities, "Chattogram")?.id).toBe(2);
    expect(matchPlace(cities, "Cumilla")?.id).toBe(3);
    expect(matchPlace(cities, "Bogura")?.id).toBe(4);
    expect(matchPlace(cities, "Cox's Bazar")?.id).toBe(5);
    expect(matchPlace(cities, "Sylhet")).toBeNull();
  });
  it("takes the closest zone when only the start matches", () => {
    const zones = [
      { id: 10, name: "Mirpur 10" },
      { id: 11, name: "Mirpur DOHS" },
      { id: 12, name: "Dhanmondi" },
      { id: 13, name: "Mi" },
    ];
    expect(matchPlace(zones, "Mirpur")?.id).toBe(10);
    expect(matchPlace(zones, "dhanmondi")?.id).toBe(12);
    expect(matchPlace(zones, "Mile")).toBeNull();
  });
});

describe("Pathao", () => {
  it("builds the order body with COD in whole taka and a parcel weight", () => {
    const body = pathaoOrderBody(pathaoCfg, { ...input, pathao: { cityId: 1, zoneId: 12 } });
    expect(body).toMatchObject({
      store_id: 12345,
      merchant_order_id: "ZLF-001234",
      recipient_phone: "01712345678",
      recipient_city: 1,
      recipient_zone: 12,
      delivery_type: 48,
      item_type: 2,
      item_quantity: 3,
      item_weight: "1.5",
      amount_to_collect: 4570,
      item_description: "Reva x2, Oudor",
    });
    expect(body).not.toHaveProperty("recipient_area");
    expect(pathaoOrderBody(pathaoCfg, { ...input, codAmount: 0 }).amount_to_collect).toBe(0);
  });

  it("weighs parcels between half a kilo and ten", () => {
    expect(parcelWeight(1)).toBe(0.5);
    expect(parcelWeight(3)).toBe(1.5);
    expect(parcelWeight(40)).toBe(10);
  });

  it("reads a created parcel, and says why one wasn't", () => {
    const c = parseCreated({
      code: 200,
      data: { consignment_id: "DL121224VS8TTJ", order_status: "Pending", delivery_fee: 60 },
    });
    expect(c).toMatchObject({
      consignmentId: "DL121224VS8TTJ",
      status: "Pending",
      deliveryFee: 6000,
    });
    expect(() =>
      parseCreated({
        message: "Please fix the given errors",
        errors: { recipient_phone: ["Invalid"] },
      }),
    ).toThrow("Please fix the given errors: Invalid");
  });

  it("accepts a webhook only with the secret set in Pathao's panel", () => {
    const p = pathao(pathaoCfg);
    const body = {
      consignment_id: "DL1",
      event: "order.delivered",
      updated_at: "2026-10-03 12:00:00",
    };
    const ok = p.handleWebhook(new Headers({ "X-PATHAO-Signature": "pathao-hook-secret" }), body);
    expect(ok).toMatchObject({ consignmentId: "DL1", status: "delivered" });
    expect(p.handleWebhook(new Headers({ "X-PATHAO-Signature": "guess" }), body)).toBeNull();
    // The set-up check from Pathao's panel: authentic, about no parcel
    const check = { event: "webhook_integration" };
    const signed = new Headers({ "X-PATHAO-Signature": "pathao-hook-secret" });
    expect(p.handleWebhook(signed, check)).toMatchObject({ consignmentId: "", status: null });
    expect(p.handleWebhook(new Headers(), check)).toBeNull();
    expect(p.handleWebhook(new Headers(), body)).toBeNull();
    expect(
      pathao({ ...pathaoCfg, webhookSecret: null }).handleWebhook(new Headers(), body),
    ).toBeNull();
  });
});

describe("Steadfast", () => {
  it("builds the order body with COD in whole taka", () => {
    expect(steadfastOrderBody(input)).toMatchObject({
      invoice: "ZLF-001234",
      recipient_address: "Road 7A, House 21, Dhanmondi, Dhaka",
      cod_amount: 4570,
      item_description: "Reva x2, Oudor",
    });
  });

  it("reads a created parcel, and says why one wasn't", () => {
    expect(
      parseSteadfastCreated({
        status: 200,
        consignment: { consignment_id: 1424107, tracking_code: "15BAEB8A", status: "in_review" },
      }),
    ).toMatchObject({ consignmentId: "1424107", trackingCode: "15BAEB8A", status: "in_review" });
    expect(() =>
      parseSteadfastCreated({ status: 400, message: "Invalid", errors: { invoice: ["Taken"] } }),
    ).toThrow("Invalid: Taken");
  });

  it("accepts a webhook only with the bearer token set in its panel", () => {
    const s = steadfast({ apiKey: "k", secretKey: "s", webhookToken: "sf-token" });
    const body = {
      notification_type: "delivery_status",
      consignment_id: 1424107,
      status: "delivered",
      updated_at: "2026-10-03 12:00:00",
    };
    expect(s.handleWebhook(new Headers({ Authorization: "Bearer sf-token" }), body)).toMatchObject({
      consignmentId: "1424107",
      status: "delivered",
    });
    expect(s.handleWebhook(new Headers({ Authorization: "Bearer sf-tokem" }), body)).toBeNull();
    expect(s.handleWebhook(new Headers(), body)).toBeNull();
    // A tracking note carries no status: noted, nothing moves
    expect(
      s.handleWebhook(new Headers({ Authorization: "Bearer sf-token" }), {
        notification_type: "tracking_update",
        consignment_id: 1424107,
        tracking_message: "At the hub",
      }),
    ).toMatchObject({ status: null, message: "At the hub" });
  });
});

describe("the test courier", () => {
  it("accepts only its own signed updates", () => {
    const hook = mockWebhook("MOCK-1", "delivered");
    expect(mockCourier.handleWebhook(new Headers(), hook)).toMatchObject({
      consignmentId: "MOCK-1",
      status: "delivered",
    });
    expect(mockCourier.handleWebhook(new Headers(), { ...hook, status: "returned" })).toBeNull();
    expect(mockCourier.handleWebhook(new Headers(), { ...hook, sig: "0".repeat(64) })).toBeNull();
    expect(mockCourier.handleWebhook(new Headers(), { ...hook, status: "teleported" })).toBeNull();
  });
});

describe("helpers", () => {
  it("collects cash only for unpaid cash-on-delivery orders", () => {
    expect(codAmountFor({ paymentMethod: "cod", paymentStatus: "unpaid", total: 457_000 })).toBe(
      457_000,
    );
    expect(codAmountFor({ paymentMethod: "cod", paymentStatus: "paid", total: 457_000 })).toBe(0);
    expect(
      codAmountFor({ paymentMethod: "sslcommerz", paymentStatus: "paid", total: 457_000 }),
    ).toBe(0);
  });

  it("links each courier's public tracking page", () => {
    expect(trackingUrl("pathao", "DL1", "01712345678")).toBe(
      "https://merchant.pathao.com/tracking?consignment_id=DL1&phone=01712345678",
    );
    expect(trackingUrl("steadfast", "15BAEB8A", "01712345678")).toBe(
      "https://steadfast.com.bd/t/15BAEB8A",
    );
    expect(trackingUrl("mock", "MK1", "01712345678")).toBeNull();
    expect(trackingUrl("pathao", null, "01712345678")).toBeNull();
  });
});

describe("RedX", () => {
  const cfg = { accessToken: "jwt", pickupStoreId: "1234", live: false, webhookToken: "hook-tok" };

  it("sends the parcel with its area, cash in whole taka and weight in grams", () => {
    const b = redxParcelBody(cfg, { ...input, redx: { areaId: 1, areaName: "Dhanmondi" } });
    expect(b).toMatchObject({
      customer_name: "Nusrat Jahan",
      customer_phone: "01712345678",
      delivery_area: "Dhanmondi",
      delivery_area_id: 1,
      merchant_invoice_id: "ZLF-001234",
      cash_collection_amount: "4570",
      parcel_weight: 1500,
      value: "4570",
      pickup_store_id: 1234,
    });
    expect(b.parcel_details_json).toEqual([
      { name: "Reva x2", category: "Perfume", value: 0 },
      { name: "Oudor", category: "Perfume", value: 0 },
    ]);
    expect(() => redxParcelBody(cfg, input)).toThrow(/area/);
    expect(redxBase(false)).toContain("sandbox.redx.com.bd");
    expect(redxBase(true)).toContain("openapi.redx.com.bd");
  });

  it("reads the tracking ID, or why RedX refused", () => {
    expect(parseRedxCreated({ tracking_id: "21A427TU4BN3R" })).toMatchObject({
      consignmentId: "21A427TU4BN3R",
      trackingCode: "21A427TU4BN3R",
      status: "pickup-pending",
    });
    expect(() =>
      parseRedxCreated({ message: "Validation failed", errors: { customer_phone: ["invalid"] } }),
    ).toThrow(/Validation failed: invalid/);
  });

  it("maps RedX's statuses to the order", () => {
    expect(mapRedx("ready-for-delivery")).toMatchObject({ order: "shipped", final: false });
    expect(mapRedx("delivery-in-progress").order).toBe("out_for_delivery");
    expect(mapRedx("delivered")).toMatchObject({ order: "delivered", final: true });
    expect(mapRedx("agent-hold").attention).toBeTruthy();
    expect(mapRedx("returned")).toMatchObject({ final: true, order: "delivery_failed" });
    expect(mapRedx("Delivery In Progress").order).toBe("out_for_delivery");
    expect(mapStatus("redx", "delivered").order).toBe("delivered");
  });

  it("accepts a webhook only with our token in the address", () => {
    const r = redx(cfg);
    const body = {
      tracking_number: "21A427TU4BN3R",
      status: "delivered",
      timestamp: "2026-10-04T10:00:00Z",
      message_en: "Parcel delivered",
      invoice_number: "ZLF-001234",
    };
    const at = (q: string) => new URL(`https://zalfi.test/api/couriers/webhook/redx${q}`);
    expect(r.handleWebhook(new Headers(), body, at("?token=hook-tok"))).toMatchObject({
      consignmentId: "21A427TU4BN3R",
      status: "delivered",
      message: "Parcel delivered",
    });
    expect(r.handleWebhook(new Headers(), body, at("?token=wrong"))).toBeNull();
    expect(r.handleWebhook(new Headers(), body, at(""))).toBeNull();
    expect(trackingUrl("redx", "21A427TU4BN3R", "01712345678")).toBe(
      "https://redx.com.bd/track-parcel/?trackingId=21A427TU4BN3R",
    );
  });
});

describe("other courier (by hand)", () => {
  it("records the courier the team named, its tracking number and link", async () => {
    const c = await manualCourier.createShipment({
      ...input,
      manual: {
        courierName: "Sundarban Courier",
        trackingCode: "SB-99812",
        trackingUrl: "https://sundarban.example/track/SB-99812",
      },
    });
    expect(c).toMatchObject({
      consignmentId: "SB-99812",
      status: "awaiting_pickup",
      raw: {
        courierName: "Sundarban Courier",
        trackingUrl: "https://sundarban.example/track/SB-99812",
      },
    });
    const own = await manualCourier.createShipment({
      ...input,
      manual: { courierName: "Own rider", trackingCode: null, trackingUrl: null },
    });
    expect(own.consignmentId).toMatch(/^MAN-[0-9A-F]{6}$/);
    await expect(
      manualCourier.createShipment({
        ...input,
        manual: { courierName: " ", trackingCode: null, trackingUrl: null },
      }),
    ).rejects.toThrow(/which courier/);
    expect(mapStatus("manual", "delivered")).toMatchObject({ order: "delivered", final: true });
    expect(manualCourier.handleWebhook(new Headers(), {})).toBeNull();
  });
});
