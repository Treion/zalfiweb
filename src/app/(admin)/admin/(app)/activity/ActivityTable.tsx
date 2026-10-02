"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ActivityIcon } from "lucide-react";
import { useState } from "react";
import { DataTable, type ColumnMeta } from "@/components/admin/data-table/DataTable";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { formatDateTime } from "@/lib/time";

type Row = {
  id: number;
  actorEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: Date;
};

const meta = (m: ColumnMeta) => m;

function Changes({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  if (row.before == null && row.after == null)
    return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        View
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{row.action}</DialogTitle>
            <DialogDescription>
              {row.actorEmail} · {formatDateTime(row.createdAt)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["before", "after"] as const).map((k) => (
              <div key={k} className="min-w-0">
                <p className="eyebrow mb-1">{k}</p>
                <pre className="bg-muted max-h-80 overflow-auto rounded-md p-3 text-xs">
                  {row[k] == null ? "—" : JSON.stringify(row[k], null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const columns: ColumnDef<Row, unknown>[] = [
  {
    id: "time",
    header: "When",
    meta: meta({ label: "When", sortKey: "time" }),
    cell: ({ row }) => (
      <span className="tabular-nums">{formatDateTime(row.original.createdAt)}</span>
    ),
  },
  {
    id: "who",
    header: "Who",
    meta: meta({ label: "Who" }),
    cell: ({ row }) => row.original.actorEmail ?? "system",
  },
  {
    id: "action",
    header: "Action",
    meta: meta({ label: "Action" }),
    cell: ({ row }) => (
      <Badge variant="neutral" className="font-mono">
        {row.original.action}
      </Badge>
    ),
  },
  {
    id: "record",
    header: "Record",
    meta: meta({ label: "Record" }),
    cell: ({ row }) =>
      row.original.entity ? (
        <span className="text-muted-foreground">
          {row.original.entity}{" "}
          {row.original.entityId && (
            <span className="text-foreground">#{row.original.entityId.slice(0, 12)}</span>
          )}
        </span>
      ) : (
        "—"
      ),
  },
  {
    id: "ip",
    header: "IP",
    meta: meta({ label: "IP" }),
    cell: ({ row }) => row.original.ip ?? "—",
  },
  {
    id: "changes",
    header: "Changes",
    meta: meta({ label: "Changes" }),
    cell: ({ row }) => <Changes row={row.original} />,
  },
];

export function ActivityTable({
  rows,
  total,
  page,
  pageSize,
  areas,
}: {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  areas: { value: string; label: string }[];
}) {
  return (
    <DataTable
      id="activity"
      columns={columns}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Search people, actions, records, IPs"
      filters={[{ key: "area", label: "Areas", options: areas }]}
      exportHref="/api/admin/export/audit"
      getRowId={(r) => String(r.id)}
      defaultSort={{ key: "time", dir: "desc" }}
      empty={
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-6">
          <ActivityIcon className="size-5" />
          Nothing logged yet for this search.
        </div>
      }
    />
  );
}
