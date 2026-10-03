"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Switch } from "@/components/admin/ui/switch";
import { formatPrice, poishaToTaka, takaToPoisha } from "@/lib/money";
import { variantSchema } from "@/server/catalog/schema";
import {
  createVariantAction,
  updateVariantAction,
} from "@/app/(admin)/admin/(app)/products/actions";

type Variant = {
  id: number;
  sku: string;
  sizeMl: number;
  pricePoisha: number;
  lowStockThreshold: number | null;
  active: boolean;
  stock: number;
  reserved: number;
};

type Draft = { sizeMl: string; sku: string; price: string; threshold: string; active: boolean };

const toDraft = (v: Variant): Draft => ({
  sizeMl: String(v.sizeMl),
  sku: v.sku,
  price: String(poishaToTaka(v.pricePoisha)),
  threshold: v.lowStockThreshold === null ? "" : String(v.lowStockThreshold),
  active: v.active,
});

function parse(d: Draft) {
  return variantSchema.safeParse({
    sizeMl: Number(d.sizeMl),
    sku: d.sku,
    pricePoisha: takaToPoisha(Number(d.price)),
    lowStockThreshold: d.threshold.trim() === "" ? null : Number(d.threshold),
    active: d.active,
  });
}
const firstIssue = (r: ReturnType<typeof parse>) =>
  r.success ? null : `${String(r.error.issues[0]?.path[0] ?? "")}: ${r.error.issues[0]?.message}`;

function SizeRow({ fragranceId, v }: { fragranceId: number; v: Variant }) {
  const [d, setD] = useState(toDraft(v));
  const [base, setBase] = useState(toDraft(v));
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(d) !== JSON.stringify(base);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  function save() {
    const r = parse(d);
    if (!r.success) return void toast.error(firstIssue(r));
    start(async () => {
      const res = await updateVariantAction({ id: v.id, fragranceId, variant: r.data });
      if (!res.ok) return void toast.error(res.error);
      setBase(d);
      toast.success(`${d.sizeMl} ml saved. The shop is updated.`);
    });
  }

  return (
    <div className="grid grid-cols-2 items-end gap-3 border-b py-4 last:border-0 sm:grid-cols-[5.5rem_1fr_8rem_6.5rem_auto] lg:grid-cols-[5.5rem_1fr_8rem_6.5rem_8rem_auto_auto]">
      <label className="flex flex-col gap-1.5 text-xs">
        Size (ml)
        <Input
          type="number"
          min={1}
          value={d.sizeMl}
          onChange={(e) => set({ sizeMl: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs">
        SKU
        <Input
          value={d.sku}
          onChange={(e) => set({ sku: e.target.value.toUpperCase() })}
          className="font-mono"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs">
        Price (৳)
        <Input
          type="number"
          min={1}
          step="1"
          value={d.price}
          onChange={(e) => set({ price: e.target.value })}
          className="tabular-nums"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs">
        Low at
        <Input
          type="number"
          min={0}
          placeholder="Default"
          value={d.threshold}
          onChange={(e) => set({ threshold: e.target.value })}
        />
      </label>
      <div className="flex flex-col gap-1.5 text-xs">
        <span>Stock</span>
        <div className="flex h-9 items-center gap-2 text-sm tabular-nums">
          {v.stock}
          {v.reserved > 0 && <Badge variant="warning">{v.reserved} held</Badge>}
          <Link
            href={`/admin/inventory?adjust=${v.id}`}
            className="text-gold text-xs underline-offset-4 hover:underline"
          >
            Adjust
          </Link>
        </div>
      </div>
      <label className="flex h-9 items-center gap-2 text-xs">
        <Switch
          checked={d.active}
          onCheckedChange={(a) => set({ active: a })}
          aria-label="On sale"
        />
        On sale
      </label>
      <Button size="sm" onClick={save} disabled={!dirty || pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function AddSize({ fragranceId, slug }: { fragranceId: number; slug: string }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Draft>({
    sizeMl: "50",
    sku: `ZLF-${slug.toUpperCase()}-50`,
    price: "",
    threshold: "",
    active: true,
  });
  const [stock, setStock] = useState("0");
  const [pending, start] = useTransition();
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  function add() {
    const r = parse(d);
    if (!r.success) return void toast.error(firstIssue(r));
    start(async () => {
      const res = await createVariantAction({
        fragranceId,
        variant: r.data,
        openingStock: Math.max(0, Math.round(Number(stock) || 0)),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${d.sizeMl} ml added.`);
      setOpen(false);
    });
  }

  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Add a size
      </Button>
    );
  return (
    <div className="bg-muted/40 grid grid-cols-2 items-end gap-3 rounded-lg border p-4 sm:grid-cols-[5.5rem_1fr_8rem_7rem_auto_auto]">
      <label className="flex flex-col gap-1.5 text-xs">
        Size (ml)
        <Input
          type="number"
          min={1}
          value={d.sizeMl}
          onChange={(e) =>
            set({ sizeMl: e.target.value, sku: `ZLF-${slug.toUpperCase()}-${e.target.value}` })
          }
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs">
        SKU
        <Input
          value={d.sku}
          onChange={(e) => set({ sku: e.target.value.toUpperCase() })}
          className="font-mono"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs">
        Price (৳)
        <Input
          type="number"
          min={1}
          value={d.price}
          onChange={(e) => set({ price: e.target.value })}
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs">
        Opening stock
        <Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
      </label>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button size="sm" onClick={add} disabled={pending}>
        {pending ? "Adding…" : "Add size"}
      </Button>
    </div>
  );
}

/** Each size: price, SKU, low-stock level and whether it's on sale. Stock changes go through Inventory. */
export function SizesEditor({
  fragranceId,
  slug,
  variants,
}: {
  fragranceId: number;
  slug: string;
  variants: Variant[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sizes and prices</CardTitle>
        <CardDescription>
          {variants.length > 1
            ? "The shop offers a size choice because there's more than one on sale."
            : "With one size on sale, the shop shows it without a size choice."}{" "}
          Stock is changed in Inventory, so every change keeps a reason.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        {variants.map((v) => (
          <SizeRow key={v.id} fragranceId={fragranceId} v={v} />
        ))}
        {!variants.length && (
          <p className="text-muted-foreground py-4 text-sm">
            No sizes yet. Add one to be able to publish.
          </p>
        )}
        <div className="pt-4">
          <AddSize fragranceId={fragranceId} slug={slug} />
        </div>
        {variants.length > 0 && (
          <p className="text-muted-foreground mt-4 text-xs">
            Prices on the shop:{" "}
            {variants
              .filter((v) => v.active)
              .map((v) => `${v.sizeMl} ml ${formatPrice(v.pricePoisha)}`)
              .join(" · ") || "none on sale"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
