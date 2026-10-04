import {
  ActivityIcon,
  BarChart3Icon,
  BoxesIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  LeafIcon,
  PackageIcon,
  PlugIcon,
  ReceiptTextIcon,
  SettingsIcon,
  TicketPercentIcon,
  TruckIcon,
  UsersIcon,
  UserCogIcon,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/server/auth/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon; permission: Permission };

/** The sidebar, in groups. Items a role may not open are hidden (and the pages refuse them too). */
export const NAV: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      {
        href: "/admin",
        label: "Overview",
        icon: LayoutDashboardIcon,
        permission: "dashboard.view",
      },
    ],
  },
  {
    label: "Sell",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ReceiptTextIcon, permission: "orders.view" },
      {
        href: "/admin/customers",
        label: "Customers",
        icon: UsersIcon,
        permission: "customers.view",
      },
      {
        href: "/admin/payments",
        label: "Payments",
        icon: CreditCardIcon,
        permission: "payments.view",
      },
      {
        href: "/admin/shipping",
        label: "Shipping",
        icon: TruckIcon,
        permission: "shipping.manage",
      },
      {
        href: "/admin/coupons",
        label: "Coupons",
        icon: TicketPercentIcon,
        permission: "coupons.manage",
      },
    ],
  },
  {
    label: "Catalogue",
    items: [
      {
        href: "/admin/products",
        label: "Products",
        icon: PackageIcon,
        permission: "products.manage",
      },
      {
        href: "/admin/notes",
        label: "Notes",
        icon: LeafIcon,
        permission: "products.manage",
      },
      {
        href: "/admin/inventory",
        label: "Inventory",
        icon: BoxesIcon,
        permission: "inventory.manage",
      },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3Icon, permission: "reports.view" },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/admin/settings",
        label: "Settings",
        icon: SettingsIcon,
        permission: "settings.view",
      },
      {
        href: "/admin/integrations",
        label: "Integrations",
        icon: PlugIcon,
        permission: "settings.view",
      },
      { href: "/admin/team", label: "Team", icon: UserCogIcon, permission: "team.manage" },
      {
        href: "/admin/activity",
        label: "Activity log",
        icon: ActivityIcon,
        permission: "audit.view",
      },
    ],
  },
];
