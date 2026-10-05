"use client";

import { MinusIcon, PlusIcon, SlidersHorizontalIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
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
import { formatPrice } from "@/lib/money";
import type { InventoryRow } from "@/server/catalog/inventory";
import { stockAdjustSchema } from "@/server/catalog/schema";
import { adjustStockAction, setThresholdAction } from "./actions";
import { sizeLabel } from "@/lib/size";

type Reason = { value: string; label: string };

const LEVEL = {
  out: { label: "Sold out", variant: "danger" },
  low: { label: "Low", variant: "warning" },
  ok: { label: "In stock", variant: "success" },
} as const;

function AdjustDialog({
  row,
  reasons,
  onClose,
}: {
  row: InventoryRow;
  reasons: Reason[];
  onClose: () => void;
}) {
  const [dir, setDir] = useState<"add" | "remove">("add");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState(reasons[0]!.value);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = Math.round(Number(qty) || 0);
  const delta = dir === "add" ? n : -n;

  function submit() {
    const check = stockAdjustSchema.safeParse({ variantId: row.variantId, delta, reason, note });
    if (!check.success) return setError(check.error.issues[0]?.message ?? "Check the form.");
    // Reductions are confirmed once more: they can't be undone except by adding stock back
    if (delta < 0 && !confirming) return setConfirming(true);
    setError(null);
    start(async () => {
      const res = await adjustStockAction(check.data);
      if (!res.ok) {
        setConfirming(false);
        return setError(res.error);
      }
      toast.success(`${row.name} ${sizeLabel(row.sizeMl, row.pieces)}: ${res.data.stock} in stock`);
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Adjust {row.name} {sizeLabel(row.sizeMl, row.pieces)}
          </DialogTitle>
          <DialogDescription>
            {row.stock} in stock{row.reserved > 0 ? `, ${row.reserved} held for unpaid orders` : ""}
            .
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Add or remove">
            {(["add", "remove"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={dir === d}
                onClick={() => {
                  setDir(d);
                  setConfirming(false);
                  // A sensible reason for the direction: new stock in, a count correction out
                  setReason(d === "add" ? "restock" : "count");
                }}
                className={`flex h-10 items-center justify-center gap-2 rounded-md border text-sm ${dir === d ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
              >
                {d === "add" ? <PlusIcon className="size-4" /> : <MinusIcon className="size-4" />}
                {d === "add" ? "Add bottles" : "Remove bottles"}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="adj-qty">How many</Label>
              <Input
                id="adj-qty"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  setConfirming(false);
                }}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="adj-reason">Why</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="adj-reason" className="w-full">
                  <SelectValue>{reasons.find((r) => r.value === reason)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adj-note">Note {reason === "other" ? "" : "(optional)"}</Label>
            <Input
              id="adj-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. Batch from the 12 Oct delivery"
            />
          </div>
          {n > 0 && (
            <p className="text-sm">
              {row.stock} → <strong className="tabular-nums">{row.stock + delta}</strong> in stock
            </p>
          )}
          {confirming && (
            <p
              role="status"
              className="rounded-md bg-[var(--tone-warning-bg)] px-3 py-2 text-sm text-[var(--tone-warning-fg)]"
            >
              Remove {n} bottle{n === 1 ? "" : "s"} from stock? Press the button again to confirm.
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || n <= 0}
              variant={confirming ? "destructive" : "default"}
            >
              {pending ? "Saving…" : confirming ? `Yes, remove ${n}` : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ThresholdCell({ row }: { row: InventoryRow }) {
  const [v, setV] = useState(row.ownThreshold === null ? "" : String(row.ownThreshold));
  const [pending, start] = useTransition();
  const save = () => {
    const next = v.trim() === "" ? null : Math.max(0, Math.round(Number(v)));
    if (next === row.ownThreshold) return;
    start(async () => {
      const res = await setThresholdAction({ variantId: row.variantId, threshold: next });
      if (!res.ok) toast.error(res.error);
      else toast.success("Low-stock level saved");
    });
  };
  return (
    <Input
      type="number"
      min={0}
      value={v}
      placeholder={String(row.threshold)}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      disabled={pending}
      aria-label={`Low-stock level for ${row.name} ${sizeLabel(row.sizeMl, row.pieces)}`}
      className="h-8 w-20 tabular-nums"
    />
  );
}

export function StockTable({
  rows,
  reasons,
  openFor,
  showValue,
}: {
  rows: InventoryRow[];
  reasons: Reason[];
  openFor: number | null;
  showValue: boolean;
}) {
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(
    () => rows.find((r) => r.variantId === openFor) ?? null,
  );
  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Size</TableHead>
              <TableHead className="text-right">In stock</TableHead>
              <TableHead className="text-right">Held</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead>Low at</TableHead>
              {showValue && <TableHead className="text-right">Value</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.variantId}
                className={
                  !r.active || !r.published
                    ? "opacity-60"
                    : r.level === "out"
                      ? "bg-[var(--tone-danger-bg)]/40"
                      : r.level === "low"
                        ? "bg-[var(--tone-warning-bg)]/40"
                        : undefined
                }
              >
                <TableCell className="pl-4">
                  <div className="font-medium">
                    {r.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      {sizeLabel(r.sizeMl, r.pieces)}
                    </span>
                    {r.setId !== null && (
                      <Badge variant="neutral" className="ml-2 align-middle">
                        Set
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground font-mono text-xs">{r.sku}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.stock}</TableCell>
                <TableCell className="text-right tabular-nums">{r.reserved || "—"}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{r.available}</TableCell>
                <TableCell>
                  <ThresholdCell row={r} />
                </TableCell>
                {showValue && (
                  <TableCell className="text-right tabular-nums">{formatPrice(r.value)}</TableCell>
                )}
                <TableCell>
                  {!r.published ? (
                    <Badge variant="neutral">Hidden</Badge>
                  ) : !r.active ? (
                    <Badge variant="neutral">Off sale</Badge>
                  ) : (
                    <Badge variant={LEVEL[r.level].variant}>{LEVEL[r.level].label}</Badge>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Button variant="outline" size="sm" onClick={() => setAdjusting(r)}>
                    <SlidersHorizontalIcon /> Adjust
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {adjusting && (
        <AdjustDialog row={adjusting} reasons={reasons} onClose={() => setAdjusting(null)} />
      )}
    </>
  );
}
