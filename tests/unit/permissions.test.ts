import { describe, expect, it } from "vitest";
import { can, DEFAULT_TOGGLES, PERMISSIONS, type Permission } from "@/server/auth/permissions";

describe("permission matrix", () => {
  it("lets the owner do everything", () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) expect(can("owner", p)).toBe(true);
  });
  it("keeps owner-only areas from managers", () => {
    for (const p of [
      "team.manage",
      "audit.view",
      "settings.manage",
      "integrations.manage",
      "payments.raw",
    ] as const)
      expect(can("manager", p)).toBe(false);
  });
  it("lets managers run the day-to-day", () => {
    for (const p of [
      "orders.manage",
      "products.manage",
      "inventory.manage",
      "shipping.manage",
      "coupons.manage",
      "customers.view",
      "reports.view",
      "settings.view",
    ] as const)
      expect(can("manager", p)).toBe(true);
  });
  it("follows the owner's toggles (refunds off, revenue on by default)", () => {
    expect(can("manager", "refunds.issue")).toBe(false);
    expect(can("manager", "revenue.view")).toBe(true);
    expect(can("manager", "refunds.issue", { ...DEFAULT_TOGGLES, managersCanRefund: true })).toBe(
      true,
    );
    expect(can("manager", "revenue.view", { ...DEFAULT_TOGGLES, managersSeeRevenue: false })).toBe(
      false,
    );
    // Toggles never restrict the owner
    expect(
      can("owner", "revenue.view", { managersCanRefund: false, managersSeeRevenue: false }),
    ).toBe(true);
  });
  it("denies unknown or missing roles", () => {
    expect(can("admin", "orders.view")).toBe(false);
    expect(can(null, "dashboard.view")).toBe(false);
    expect(can(undefined, "dashboard.view")).toBe(false);
  });
});
