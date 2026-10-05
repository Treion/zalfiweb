import Image from "next/image";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { formatPrice } from "@/lib/money";
import { sizeLabel } from "@/lib/size";
import type { SetAdminRow } from "@/server/catalog/sets";

/** Products → Discovery sets: each set, what's in its box, its pack and whether it's on sale */
export function SetsTable({ rows }: { rows: SetAdminRow[] }) {
  return (
    <Card id="sets" className="mt-8 scroll-mt-20">
      <CardHeader>
        <CardTitle>Discovery sets</CardTitle>
        <CardDescription>
          Three fragrances in small vials, sold as one box. Each set has its own stock, separate
          from the bottles.
        </CardDescription>
        <CardAction>
          <Button variant="outline" asChild>
            <Link href="/admin/products/sets/new">
              <PlusIcon /> New set
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No discovery sets yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Set</TableHead>
                  <TableHead>In the box</TableHead>
                  <TableHead>Pack</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead>Shop</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/admin/products/sets/${s.id}`}
                        className="flex items-center gap-3 font-medium hover:underline"
                      >
                        <span className="relative size-10 shrink-0 overflow-hidden rounded bg-[#efeae1]">
                          <Image
                            src={s.image}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-contain p-0.5"
                          />
                        </span>
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.contents.join(", ")}</TableCell>
                    <TableCell>
                      {s.pack
                        ? `${sizeLabel(s.pack.sizeMl, s.pack.pieces)} · ${formatPrice(s.pack.pricePoisha)}`
                        : "No pack"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.pack ? s.pack.available : "–"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.published ? "success" : "neutral"}>
                        {s.published ? "On the shop" : "Hidden"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
