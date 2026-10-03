"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { setNotesAction } from "@/app/(admin)/admin/(app)/products/actions";
import { LAYER_LABELS } from "./labels";

type Layer = "top" | "heart" | "base";
type Row = { key: string; noteSlug: string; label: string };
type Lib = { slug: string; name: string }[];

let uid = 0;
const nextKey = () => `n${++uid}`;

/** The pyramid: top, heart and base notes, each a note from the library with this fragrance's wording */
export function NotesEditor({
  id,
  initial,
  library,
}: {
  id: number;
  initial: { noteSlug: string; layer: Layer; label: string }[];
  library: Lib;
}) {
  const build = () =>
    Object.fromEntries(
      (["top", "heart", "base"] as Layer[]).map((l) => [
        l,
        initial
          .filter((n) => n.layer === l)
          .map((n) => ({ key: nextKey(), noteSlug: n.noteSlug, label: n.label })),
      ]),
    ) as Record<Layer, Row[]>;
  const [rows, setRows] = useState(build);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const nameOf = (slug: string) => library.find((n) => n.slug === slug)?.name ?? slug;

  const update = (layer: Layer, fn: (list: Row[]) => Row[]) => {
    setRows((r) => ({ ...r, [layer]: fn(r[layer]) }));
    setDirty(true);
  };
  const move = (layer: Layer, i: number, by: number) =>
    update(layer, (list) => {
      const next = [...list];
      const [x] = next.splice(i, 1);
      next.splice(i + by, 0, x!);
      return next;
    });

  function save() {
    const notes = (["top", "heart", "base"] as Layer[]).flatMap((layer) =>
      rows[layer].map((r) => ({
        noteSlug: r.noteSlug,
        layer,
        label: r.label.trim() || nameOf(r.noteSlug),
      })),
    );
    start(async () => {
      const res = await setNotesAction({ id, notes });
      if (!res.ok) return void toast.error(res.error);
      setDirty(false);
      toast.success("Notes saved. The shop is updated.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>
          Pick each note from the library (its photo comes with it) and write how this fragrance
          names it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
        {(["top", "heart", "base"] as Layer[]).map((layer) => (
          <section
            key={layer}
            aria-label={`${LAYER_LABELS[layer]} notes`}
            className="flex flex-col gap-3"
          >
            <h3 className="eyebrow">{LAYER_LABELS[layer]}</h3>
            {rows[layer].map((r, i) => (
              <div key={r.key} className="flex flex-col gap-2 rounded-md border p-2.5">
                <Select
                  value={r.noteSlug}
                  onValueChange={(v) =>
                    update(layer, (list) =>
                      list.map((x) => (x.key === r.key ? { ...x, noteSlug: v } : x)),
                    )
                  }
                >
                  <SelectTrigger className="w-full" size="sm" aria-label="Note">
                    <SelectValue>{nameOf(r.noteSlug)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {library.map((n) => (
                      <SelectItem key={n.slug} value={n.slug}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Input
                    value={r.label}
                    placeholder={nameOf(r.noteSlug)}
                    aria-label="How this fragrance names it"
                    onChange={(e) =>
                      update(layer, (list) =>
                        list.map((x) => (x.key === r.key ? { ...x, label: e.target.value } : x)),
                      )
                    }
                    className="h-8"
                    maxLength={60}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === 0}
                    onClick={() => move(layer, i, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === rows[layer].length - 1}
                    onClick={() => move(layer, i, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => update(layer, (list) => list.filter((x) => x.key !== r.key))}
                    aria-label="Remove note"
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                update(layer, (list) => [
                  ...list,
                  { key: nextKey(), noteSlug: library[0]?.slug ?? "", label: "" },
                ])
              }
              disabled={!library.length}
            >
              <PlusIcon /> Add a {LAYER_LABELS[layer].toLowerCase()} note
            </Button>
          </section>
        ))}
      </CardContent>
      <CardFooter className="justify-end gap-3 border-t">
        {dirty && <span className="text-muted-foreground text-xs">Unsaved changes</span>}
        <Button onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save notes"}
        </Button>
      </CardFooter>
    </Card>
  );
}
