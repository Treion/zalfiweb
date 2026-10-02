/**
 * Who may do what in the admin: one matrix, read by the sidebar, every page, every server action
 * and every route handler. Change access here, and only here.
 *
 *   true            always allowed
 *   false           never allowed
 *   "<toggle>"      allowed when that owner toggle (Settings → Team) is on
 */
export const ROLES = ["owner", "manager"] as const;
export type Role = (typeof ROLES)[number];

/** Owner-only switches that widen what managers may do (see settings: `permissions`) */
export type PermissionToggles = {
  /** Default off */
  managersCanRefund: boolean;
  /** Default on */
  managersSeeRevenue: boolean;
};

export const DEFAULT_TOGGLES: PermissionToggles = {
  managersCanRefund: false,
  managersSeeRevenue: true,
};

type Rule = boolean | keyof PermissionToggles;

export const PERMISSIONS = {
  "dashboard.view": { owner: true, manager: true },
  "revenue.view": { owner: true, manager: "managersSeeRevenue" },
  "orders.view": { owner: true, manager: true },
  "orders.manage": { owner: true, manager: true },
  "refunds.issue": { owner: true, manager: "managersCanRefund" },
  "products.manage": { owner: true, manager: true },
  "inventory.manage": { owner: true, manager: true },
  "customers.view": { owner: true, manager: true },
  "payments.view": { owner: true, manager: true },
  /** Raw provider payloads (card and wallet details as SSLCommerz reports them) */
  "payments.raw": { owner: true, manager: false },
  "shipping.manage": { owner: true, manager: true },
  "coupons.manage": { owner: true, manager: true },
  "reports.view": { owner: true, manager: true },
  "exports.csv": { owner: true, manager: true },
  /** Read the shipping, payment and inventory settings */
  "settings.view": { owner: true, manager: true },
  "settings.manage": { owner: true, manager: false },
  "integrations.manage": { owner: true, manager: false },
  "team.manage": { owner: true, manager: false },
  "audit.view": { owner: true, manager: false },
} as const satisfies Record<string, Record<Role, Rule>>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Whether `role` may do `permission`, given the owner's toggles. Unknown roles may do nothing. */
export function can(
  role: string | null | undefined,
  permission: Permission,
  toggles: PermissionToggles = DEFAULT_TOGGLES,
): boolean {
  if (!isRole(role)) return false;
  const rule: Rule = PERMISSIONS[permission][role];
  return typeof rule === "boolean" ? rule : toggles[rule];
}
