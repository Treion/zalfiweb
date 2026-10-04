"use client";

import { LogOutIcon, MenuIcon, ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { authClient } from "@/server/auth/client";
import { ThemeToggle } from "@/components/admin/theme";
import { Avatar, AvatarFallback } from "@/components/admin/ui/avatar";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/admin/ui/sheet";
import { NavList } from "./Sidebar";
import { SearchBox } from "./SearchBox";

type Me = { name: string; email: string; role: string };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function Topbar({
  me,
  allowed,
  badges,
}: {
  me: Me;
  allowed: string[];
  badges?: Record<string, number>;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await authClient.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <header className="bg-background/90 sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
      {/* Mobile and tablet: the navigation in a drawer */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <MenuIcon />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-sidebar w-64 p-0">
          <SheetTitle className="flex h-14 items-center border-b px-4">
            <Logo variant="wordmark" title="ZALFI" className="h-4 w-auto" />
          </SheetTitle>
          <div className="px-3 py-2">
            <NavList allowed={allowed} badges={badges} onNavigate={() => setMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <SearchBox />

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2" aria-label="Account">
              <Avatar className="size-7">
                <AvatarFallback>{initials(me.name)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm md:inline">{me.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span>{me.name}</span>
              <span className="text-muted-foreground text-xs font-normal">{me.email}</span>
              <Badge variant="neutral" className="mt-1 capitalize">
                <ShieldCheckIcon /> {me.role}
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOutIcon /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
