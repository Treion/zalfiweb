import Link from "next/link";
import { SearchIcon, SearchXIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { requireAdmin } from "@/server/auth/session";
import { globalSearch } from "@/server/search";

export async function generateMetadata({ searchParams }: PageProps<"/admin/search">) {
  const q = (await searchParams).q;
  return { title: q ? `Search: ${String(q).slice(0, 40)}` : "Search" };
}

export default async function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  const admin = await requireAdmin("dashboard.view");
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const groups = q.length >= 2 ? await globalSearch(q, admin.can, 20) : [];

  return (
    <>
      <PageHeader
        title="Search"
        description="Orders by number, phone, name or email; customers; fragrances by name or SKU."
      />
      <form action="/admin/search" role="search" className="relative mb-6 max-w-xl">
        <SearchIcon
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <input
          name="q"
          type="search"
          defaultValue={q}
          autoFocus={!q}
          aria-label="Search"
          placeholder="ZLF-001234, 01712-345678, Oudor…"
          className="border-input bg-background focus-visible:ring-ring/50 h-10 w-full rounded-md border pr-3 pl-9 text-sm outline-none focus-visible:ring-[3px]"
        />
      </form>

      {q.length < 2 ? (
        <p className="text-muted-foreground text-sm">Type at least two letters or digits.</p>
      ) : groups.length === 0 ? (
        <EmptyState icon={SearchXIcon} title={`Nothing matches “${q}”`}>
          Try part of a phone number, an order number like 1234, or a fragrance name.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <Card key={g.kind} className="gap-3">
              <CardHeader>
                <div className="flex items-baseline justify-between gap-3">
                  <CardTitle>
                    {g.label}{" "}
                    <span className="text-muted-foreground text-sm font-normal">{g.total}</span>
                  </CardTitle>
                  {g.more && g.total > g.hits.length && (
                    <Link
                      href={g.more}
                      className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
                    >
                      {`All ${g.total} in ${g.label}`}
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="-mx-2 flex flex-col">
                  {g.hits.map((h) => (
                    <li key={h.href}>
                      <Link
                        href={h.href}
                        className="hover:bg-accent focus-visible:ring-ring/50 flex flex-col rounded-md px-2 py-2 text-sm outline-none focus-visible:ring-[3px]"
                      >
                        <span className="font-medium">{h.title}</span>
                        <span className="text-muted-foreground truncate text-xs">{h.detail}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
