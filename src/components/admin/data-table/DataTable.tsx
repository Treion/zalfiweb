"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  SearchIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { cn } from "@/components/admin/lib/utils";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Input } from "@/components/admin/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";

export type FilterDef = { key: string; label: string; options: { value: string; label: string }[] };

/** Column meta: `sortKey` makes the header a sort toggle (the server sorts); `className` styles cells */
export type ColumnMeta = { sortKey?: string; className?: string; label?: string };

type Props<T> = {
  /** Remembers column visibility per table in this browser */
  id: string;
  columns: ColumnDef<T, unknown>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  /** CSV export of the current search and filters (a route handler that also audit-logs it) */
  exportHref?: string;
  /** Shown when rows are selected */
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  getRowId?: (row: T) => string;
  empty?: React.ReactNode;
  rowHref?: (row: T) => string | null;
  /** The sort the server applies when the URL names none (shown on its header) */
  defaultSort?: { key: string; dir: "asc" | "desc" };
};

/**
 * The admin's list table. Data arrives one page at a time from the server; search, filters, sort and
 * page live in the URL. Column visibility is remembered per table; bulk actions act on the selection.
 * Below md the rows become stacked cards, so phones get a usable list without horizontal scroll.
 */
export function DataTable<T>({
  id,
  columns,
  rows,
  total,
  page,
  pageSize,
  searchPlaceholder = "Search",
  filters = [],
  exportHref,
  bulkActions,
  getRowId,
  empty,
  rowHref,
  defaultSort,
}: Props<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [selection, setSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`zalfi-admin-cols:${id}`);
      if (saved) setVisibility(JSON.parse(saved) as VisibilityState);
    } catch {
      /* storage unavailable */
    }
  }, [id]);

  const setParams = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage) next.delete("page");
    setSelection({});
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced search
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => setParams({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const selectColumn = useMemo<ColumnDef<T, unknown> | null>(
    () =>
      bulkActions
        ? {
            id: "_select",
            enableHiding: false,
            header: ({ table }) => (
              <Checkbox
                aria-label="Select all on this page"
                checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                aria-label="Select row"
                checked={row.getIsSelected()}
                onCheckedChange={(v) => row.toggleSelected(!!v)}
                onClick={(e) => e.stopPropagation()}
              />
            ),
          }
        : null,
    [bulkActions],
  );

  const table = useReactTable({
    data: rows,
    columns: selectColumn ? [selectColumn, ...columns] : columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    getRowId: getRowId ? (r) => getRowId(r) : undefined,
    state: { columnVisibility: visibility, rowSelection: selection },
    onColumnVisibilityChange: (updater) => {
      setVisibility((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        try {
          localStorage.setItem(`zalfi-admin-cols:${id}`, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    onRowSelectionChange: setSelection,
  });

  const sort = params.get("sort") ?? defaultSort?.key ?? null;
  const dir = params.get("dir")
    ? params.get("dir") === "asc"
      ? "asc"
      : "desc"
    : (defaultSort?.dir ?? "desc");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const anyFilter = filters.some((f) => params.get(f.key)) || !!params.get("q");
  const exportUrl = exportHref
    ? `${exportHref}${exportHref.includes("?") ? "&" : "?"}${params.toString()}`
    : null;

  return (
    <div className={cn("flex flex-col gap-3 transition-opacity", pending && "opacity-60")}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {filters.map((f) => (
          <Select
            key={f.key}
            value={params.get(f.key) ?? "__all"}
            onValueChange={(v) => setParams({ [f.key]: v === "__all" ? null : v })}
          >
            <SelectTrigger aria-label={f.label} className="min-w-36">
              {/* Explicit text, so the server render shows the choice too (not only after hydration) */}
              <SelectValue placeholder={f.label}>
                {f.options.find((o) => o.value === params.get(f.key))?.label ??
                  `All ${f.label.toLowerCase()}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All {f.label.toLowerCase()}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {anyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setParams(Object.fromEntries([["q", null], ...filters.map((f) => [f.key, null])]));
            }}
          >
            <XIcon /> Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {exportUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={exportUrl} download>
                <DownloadIcon /> CSV
              </a>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Choose columns">
                <Settings2Icon /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(!!v)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {(c.columnDef.meta as ColumnMeta | undefined)?.label ?? c.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {bulkActions && selected.length > 0 && (
        <div className="bg-muted flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          {bulkActions(selected, () => setSelection({}))}
        </div>
      )}

      {/* Table (md and up) */}
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta as ColumnMeta | undefined;
                  const active = meta?.sortKey && sort === meta.sortKey;
                  return (
                    <TableHead key={h.id} className={meta?.className}>
                      {meta?.sortKey ? (
                        <button
                          type="button"
                          className="hover:text-foreground -ml-1 inline-flex items-center gap-1 rounded px-1"
                          onClick={() =>
                            setParams(
                              {
                                sort: meta.sortKey!,
                                dir: active && dir === "desc" ? "asc" : "desc",
                              },
                              false,
                            )
                          }
                          aria-label={`Sort by ${meta.label ?? h.column.id}`}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {active ? (
                            dir === "asc" ? (
                              <ArrowUpIcon className="size-3.5" />
                            ) : (
                              <ArrowDownIcon className="size-3.5" />
                            )
                          ) : (
                            <ArrowUpDownIcon className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : h.isPlaceholder ? null : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const href = rowHref?.(row.original);
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={href ? "cursor-pointer" : undefined}
                    onClick={href ? () => router.push(href) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          (cell.column.columnDef.meta as ColumnMeta | undefined)?.className
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-40 text-center whitespace-normal"
                >
                  {empty ?? <span className="text-muted-foreground">Nothing matches.</span>}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cards (below md) */}
      <div className="flex flex-col gap-2 md:hidden">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <div key={row.id} className="bg-card rounded-lg border p-3 text-sm">
              {row.getVisibleCells().map((cell) => {
                if (cell.column.id === "_select") return null;
                const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                return (
                  <div key={cell.id} className="flex items-start justify-between gap-3 py-1">
                    <span className="text-muted-foreground text-xs">
                      {meta?.label ?? cell.column.id}
                    </span>
                    <span className="min-w-0 text-right">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <div className="rounded-lg border p-8 text-center">{empty ?? "Nothing matches."}</div>
        )}
      </div>

      {/* Pagination */}
      <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
        <span>
          {total === 0
            ? "No results"
            : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString("en-IN")}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => setParams({ page: String(page - 1) }, false)}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </Button>
          <span className="px-2 tabular-nums">
            {page} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= pages}
            onClick={() => setParams({ page: String(page + 1) }, false)}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
