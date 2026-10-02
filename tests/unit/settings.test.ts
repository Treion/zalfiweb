import { describe, expect, it } from "vitest";
import { DHAKA_CITY_THANAS } from "@/lib/bd-geo";
import {
  defaultSettings,
  parseSettings,
  SETTINGS_KEYS,
  SETTINGS_SCHEMAS,
} from "@/server/settings/schema";

describe("settings", () => {
  it("has complete defaults for every section", () => {
    for (const k of SETTINGS_KEYS) expect(() => defaultSettings(k)).not.toThrow();
  });
  it("defaults match the spec: ৳70 inside Dhaka, ৳200 outside, COD off, 30 min expiry", () => {
    const ship = defaultSettings("shipping");
    expect(ship.insideDhakaFee).toBe(7_000);
    expect(ship.outsideDhakaFee).toBe(20_000);
    expect(ship.freeShippingThreshold).toBeNull();
    expect(ship.insideDhakaAreas).toEqual([...DHAKA_CITY_THANAS]);
    const pay = defaultSettings("payments");
    expect(pay.codEnabled).toBe(false);
    expect(pay.sslcommerzEnabled).toBe(true);
    expect(pay.unpaidExpiryMinutes).toBe(30);
    expect(defaultSettings("permissions")).toEqual({
      managersCanRefund: false,
      managersSeeRevenue: true,
    });
  });
  it("fills fields that were never saved", () => {
    const v = parseSettings("shipping", { insideDhakaFee: 8_000 });
    expect(v.insideDhakaFee).toBe(8_000);
    expect(v.outsideDhakaFee).toBe(20_000);
  });
  it("keeps valid fields when a stored value has a bad one", () => {
    const v = parseSettings("shipping", { insideDhakaFee: -5, outsideDhakaFee: 25_000 });
    expect(v.insideDhakaFee).toBe(7_000);
    expect(v.outsideDhakaFee).toBe(25_000);
  });
  it("rejects unknown fields when saving (strict)", () => {
    const res = SETTINGS_SCHEMAS.inventory
      .strict()
      .safeParse({ lowStockThreshold: 3, sneaky: true });
    expect(res.success).toBe(false);
  });
  it("rejects negative money", () => {
    expect(
      SETTINGS_SCHEMAS.shipping.safeParse({ ...defaultSettings("shipping"), outsideDhakaFee: -1 })
        .success,
    ).toBe(false);
  });
});
