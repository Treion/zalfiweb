"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/components/admin/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/admin/ui/tooltip";
import { NAV } from "./nav";

export const SIDEBAR_COOKIE = "zalfi-admin-sidebar";

function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** The navigation list, shared by the desktop sidebar and the mobile drawer */
export function NavList({
  allowed,
  collapsed = false,
  onNavigate,
}: {
  allowed: string[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {NAV.map((group, gi) => {
        const items = group.items.filter((i) => allowed.includes(i.href));
        if (!items.length) return null;
        return (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.label && !collapsed && <p className="eyebrow mb-1.5 px-3">{group.label}</p>}
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    active && "bg-sidebar-accent text-sidebar-foreground font-medium",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <item.icon className={cn("size-4 shrink-0", active && "text-gold")} />
                  {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar (lg and up). Collapses to icons; the choice is kept in a cookie. */
export function Sidebar({
  allowed,
  initialCollapsed,
}: {
  allowed: string[];
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/admin; max-age=31536000; samesite=lax`;
  };
  return (
    <aside
      className={cn(
        "bg-sidebar border-sidebar-border sticky top-0 hidden h-svh shrink-0 flex-col border-r transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn("flex h-14 items-center border-b px-4", collapsed && "justify-center px-0")}
      >
        <Link href="/admin" aria-label="ZALFI admin, overview" className="text-sidebar-foreground">
          {collapsed ? (
            <Logo variant="emblem" title={null} className="h-6 w-auto" />
          ) : (
            <span className="flex items-baseline gap-2">
              <Logo variant="wordmark" title={null} className="h-4 w-auto" />
              <span className="eyebrow text-[0.6rem]">Admin</span>
            </span>
          )}
        </Link>
      </div>
      <div className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        <NavList allowed={allowed} collapsed={collapsed} />
      </div>
      <button
        type="button"
        onClick={toggle}
        className="text-muted-foreground hover:text-foreground flex h-11 items-center justify-center gap-2 border-t text-xs"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpenIcon className="size-4" />
        ) : (
          <PanelLeftCloseIcon className="size-4" />
        )}
        {!collapsed && "Collapse"}
      </button>
    </aside>
  );
}
