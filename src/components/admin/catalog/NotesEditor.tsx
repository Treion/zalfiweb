"use client";

import Image from "next/image";
import Link from "next/link";
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
import { NewNoteDialog } from "./NewNoteDialog";

type Layer = "top" | "heart" | "base";
type Row = { key: string; noteSlug: string; label: string };
type Lib = { slug: string; name: string; image: string }[];

/** What the home page's chapters show per layer (NOTE_SLOTS): three, two on phones */
const SHOWN = 3;
const NEW = "__new__";

function Thumb({ src }: { src?: string }) {
  if (!src) return <span className="bg-muted size-6 shrink-0 rounded" />;
  return (
    <span className="bg-muted relative size-6 shrink-0 overflow-hidden rounded">
      <Image src={src} alt="" fill sizes="24px" className="object-contain p-0.5" />
    </span>
  );
}

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
  const [lib, setLib] = useState(library);
  // The row a new note is being made for (from its picker's "New note…")
  const [making, setMaking] = useState<{ layer: Layer; key: string } | null>(null);
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
  const nameOf = (slug: string) => lib.find((n) => n.slug === slug)?.name ?? slug;
  const imageOf = (slug: string) => lib.find((n) => n.slug === slug)?.image;

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
          names it. The home page shows up to {SHOWN} per layer, two on phones.{" "}
          <Link href="/admin/notes" className="text-foreground underline underline-offset-4">
            Manage notes
          </Link>
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
                    v === NEW
                      ? setMaking({ layer, key: r.key })
                      : update(layer, (list) =>
                          list.map((x) => (x.key === r.key ? { ...x, noteSlug: v } : x)),
                        )
                  }
                >
                  <SelectTrigger className="w-full" size="sm" aria-label="Note">
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <Thumb src={imageOf(r.noteSlug)} />
                        {nameOf(r.noteSlug)}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {lib.map((n) => (
                      <SelectItem key={n.slug} value={n.slug}>
                        <span className="flex items-center gap-2">
                          <Thumb src={n.image} />
                          {n.name}
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW}>
                      <PlusIcon /> New note…
                    </SelectItem>
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
                  { key: nextKey(), noteSlug: lib[0]?.slug ?? "", label: "" },
                ])
              }
              disabled={!lib.length}
            >
              <PlusIcon /> Add a {LAYER_LABELS[layer].toLowerCase()} note
            </Button>
            {rows[layer].length > SHOWN && (
              <p className="text-muted-foreground text-xs">
                The home page shows the first {SHOWN}; the product page shows them all.
              </p>
            )}
          </section>
        ))}
      </CardContent>
      <NewNoteDialog
        open={!!making}
        onOpenChange={(o) => !o && setMaking(null)}
        onCreated={(n) => {
          setLib((l) =>
            [...l, { slug: n.slug, name: n.name, image: n.image }].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          );
          if (making)
            update(making.layer, (list) =>
              list.map((x) => (x.key === making.key ? { ...x, noteSlug: n.slug } : x)),
            );
        }}
      />
      <CardFooter className="justify-end gap-3 border-t">
        {dirty && <span className="text-muted-foreground text-xs">Unsaved changes</span>}
        <Button onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save notes"}
        </Button>
      </CardFooter>
    </Card>
  );
}
