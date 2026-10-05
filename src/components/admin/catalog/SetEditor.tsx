"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
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
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import { SET_SIZE } from "@/lib/discovery";
import { formatPrice, poishaToTaka, takaToPoisha } from "@/lib/money";
import { sizeLabel } from "@/lib/size";
import {
  newSetSchema,
  setDetailsSchema,
  setFragrancesSchema,
  setPackSchema,
} from "@/server/catalog/schema";
import {
  createSetAction,
  replaceSetPhotoAction,
  setSetContentsAction,
  updateSetAction,
  updateSetPackAction,
} from "@/app/(admin)/admin/(app)/products/sets/actions";
import { FilePick } from "./FilePick";

/**
 * A discovery set in the admin: its details, the three fragrances in the box, the box photo and
 * the pack. The box photo is shown on bone, as on the shop.
 */

export type Choice = { id: number; name: string; published: boolean };

const BONE = "#efeae1";
const firstIssue = (e: { issues: { message: string }[] }) =>
  e.issues[0]?.message ?? "Check the form.";

function Field({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

/** Three selects, one per vial, each a different fragrance */
function ContentsPicker({
  value,
  onChange,
  choices,
}: {
  value: (number | null)[];
  onChange: (v: (number | null)[]) => void;
  choices: Choice[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: SET_SIZE }, (_, i) => (
        <Field key={i} id={`set-f${i}`} label={`Vial ${i + 1}`}>
          <Select
            value={value[i] ? String(value[i]) : ""}
            onValueChange={(v) => onChange(value.map((x, j) => (j === i ? Number(v) : x)))}
          >
            <SelectTrigger id={`set-f${i}`} className="w-full">
              <SelectValue placeholder="Choose a fragrance" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((c) => (
                <SelectItem
                  key={c.id}
                  value={String(c.id)}
                  disabled={value.some((x, j) => j !== i && x === c.id)}
                >
                  {c.name}
                  {!c.published && " (hidden)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

export type SetDetails = {
  name: string;
  tagline: string;
  story: string;
  imageAlt: string;
  sortOrder: number;
  published: boolean;
};

export function SetDetailsCard({ id, initial }: { id: number; initial: SetDetails }) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof SetDetails>(k: K, v: SetDetails[K]) =>
    setD((x) => ({ ...x, [k]: v }));

  function save() {
    const parsed = setDetailsSchema.safeParse(d);
    if (!parsed.success) return void toast.error(firstIssue(parsed.error));
    start(async () => {
      const r = await updateSetAction({ id, details: parsed.data });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>
          Shown on the Discovery page, the home page and in the bag. Keep the tagline under 15
          words.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <Field id="set-name" label="Name">
          <Input id="set-name" value={d.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field id="set-order" label="Order" hint="Lower comes first.">
          <Input
            id="set-order"
            type="number"
            min={0}
            value={d.sortOrder}
            onChange={(e) => set("sortOrder", Number(e.target.value))}
          />
        </Field>
        <div className="md:col-span-2">
          <Field id="set-tagline" label="Tagline">
            <Input
              id="set-tagline"
              value={d.tagline}
              onChange={(e) => set("tagline", e.target.value)}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field
            id="set-alt"
            label="Photo description"
            hint="For screen readers: what the box looks like."
          >
            <Input
              id="set-alt"
              value={d.imageAlt}
              onChange={(e) => set("imageAlt", e.target.value)}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field
            id="set-story"
            label="Description for search engines"
            hint="Not shown as a paragraph on the shop."
          >
            <Textarea
              id="set-story"
              rows={3}
              value={d.story}
              onChange={(e) => set("story", e.target.value)}
            />
          </Field>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={d.published}
            onCheckedChange={(v) => set("published", v)}
            aria-label="On the shop"
          />
          {d.published ? "On the shop" : "Hidden from the shop"}
        </label>
        <Button onClick={save} disabled={pending}>
          Save details
        </Button>
      </CardFooter>
    </Card>
  );
}

export function SetContentsCard({
  id,
  initial,
  choices,
}: {
  id: number;
  initial: number[];
  choices: Choice[];
}) {
  const router = useRouter();
  const [value, setValue] = useState<(number | null)[]>(
    Array.from({ length: SET_SIZE }, (_, i) => initial[i] ?? null),
  );
  const [pending, start] = useTransition();
  const dirty = value.some((v, i) => v !== (initial[i] ?? null));

  function save() {
    const parsed = setFragrancesSchema.safeParse(value);
    if (!parsed.success) return void toast.error(firstIssue(parsed.error));
    start(async () => {
      const r = await setSetContentsAction({ id, fragranceIds: parsed.data });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>In the box</CardTitle>
        <CardDescription>
          One vial of each, in this order. The fragrances&apos; pages point to the set they&apos;re
          in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ContentsPicker value={value} onChange={setValue} choices={choices} />
      </CardContent>
      {dirty && (
        <CardFooter className="justify-end border-t">
          <Button onClick={save} disabled={pending}>
            Save contents
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export function SetPhotoCard({ id, src, alt }: { id: number; src: string; alt: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState(0);
  const [pending, start] = useTransition();

  function upload() {
    if (!file) return;
    const form = new FormData();
    form.set("data", JSON.stringify({ id }));
    form.set("photo", file);
    start(async () => {
      const r = await replaceSetPhotoAction(form);
      if (!r.ok) return void toast.error(r.error);
      setFile(null);
      setKey((k) => k + 1);
      toast.success("The new box photo is on the shop.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Box photo</CardTitle>
        <CardDescription>
          The real box, cut out on a transparent background. It&apos;s shown whole, on bone paper.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-[14rem_1fr]">
        <div
          className="relative aspect-[3/4] overflow-hidden rounded-lg border"
          style={{ background: BONE }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes="224px"
            quality={90}
            className="object-contain p-3"
          />
        </div>
        <FilePick
          key={key}
          name="photo"
          accept="image/png,image/webp"
          label="Choose or drop a new photo"
          hint="Transparent PNG or WebP, up to 4 MB"
          onFiles={(f) => setFile(f[0] ?? null)}
          className="bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]"
        />
      </CardContent>
      {file && (
        <CardFooter className="justify-end gap-3 border-t">
          <Button
            variant="outline"
            onClick={() => (setFile(null), setKey((k) => k + 1))}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={upload} disabled={pending}>
            {pending ? "Uploading…" : "Use this photo"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export type SetPack = {
  sku: string;
  sizeMl: number;
  pieces: number;
  pricePoisha: number;
  lowStockThreshold: number | null;
  active: boolean;
  stock: number;
  available: number;
};

export function SetPackCard({ id, pack }: { id: number; pack: SetPack }) {
  const router = useRouter();
  const [sizeMl, setSizeMl] = useState(String(pack.sizeMl));
  const [price, setPrice] = useState(String(poishaToTaka(pack.pricePoisha)));
  const [threshold, setThreshold] = useState(
    pack.lowStockThreshold === null ? "" : String(pack.lowStockThreshold),
  );
  const [active, setActive] = useState(pack.active);
  const [pending, start] = useTransition();

  function save() {
    const parsed = setPackSchema.safeParse({
      sizeMl: Number(sizeMl),
      pricePoisha: takaToPoisha(Number(price)),
      lowStockThreshold: threshold === "" ? null : Number(threshold),
      active,
    });
    if (!parsed.success) return void toast.error(firstIssue(parsed.error));
    start(async () => {
      const r = await updateSetPackAction({ id, pack: parsed.data });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pack and price</CardTitle>
        <CardDescription>
          {sizeLabel(pack.sizeMl, pack.pieces)} · {formatPrice(pack.pricePoisha)} · {pack.available}{" "}
          boxes available ({pack.stock} in stock). Change the stock in Inventory.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-3">
        <Field id="pack-ml" label="Each vial (ml)" hint={`${pack.pieces} vials in the box.`}>
          <Input
            id="pack-ml"
            type="number"
            min={1}
            value={sizeMl}
            onChange={(e) => setSizeMl(e.target.value)}
          />
        </Field>
        <Field id="pack-price" label="Price (৳)">
          <Input
            id="pack-price"
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Field id="pack-low" label="Low stock below" hint="Empty: the default from Settings.">
          <Input
            id="pack-low"
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </Field>
        <p className="text-muted-foreground text-xs md:col-span-3">SKU {pack.sku}</p>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={active} onCheckedChange={setActive} aria-label="Pack on sale" />
          {active ? "On sale" : "Off: can't be bought"}
        </label>
        <Button onClick={save} disabled={pending}>
          Save pack
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ---------------------------------------------------------------------------------------------- */

export function NewSetForm({ choices }: { choices: Choice[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [contents, setContents] = useState<(number | null)[]>(Array(SET_SIZE).fill(null));
  const [sizeMl, setSizeMl] = useState("3");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, start] = useTransition();

  function create() {
    const parsed = newSetSchema.safeParse({
      name,
      slug:
        slug ||
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      tagline,
      imageAlt,
      fragranceIds: contents,
      sizeMl: Number(sizeMl),
      pricePoisha: takaToPoisha(Number(price)),
    });
    if (!parsed.success) return void toast.error(firstIssue(parsed.error));
    if (!photo) return void toast.error("Add the box photo.");
    const form = new FormData();
    form.set("data", JSON.stringify(parsed.data));
    form.set("photo", photo);
    start(async () => {
      const r = await createSetAction(form);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Set created. Add stock in Inventory, then show it on the shop.");
      router.push(`/admin/products/sets/${r.data.id}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New discovery set</CardTitle>
        <CardDescription>
          It starts hidden, with no boxes in stock. Add stock in Inventory, then switch it on.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <Field id="new-set-name" label="Name">
          <Input id="new-set-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          id="new-set-slug"
          label="Short name"
          hint="Lowercase, for the page address and the SKU, e.g. black. Can't change later."
        >
          <Input id="new-set-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field id="new-set-tagline" label="Tagline">
            <Input
              id="new-set-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <ContentsPicker value={contents} onChange={setContents} choices={choices} />
        </div>
        <Field id="new-set-ml" label="Each vial (ml)" hint={`${SET_SIZE} vials in the box.`}>
          <Input
            id="new-set-ml"
            type="number"
            min={1}
            value={sizeMl}
            onChange={(e) => setSizeMl(e.target.value)}
          />
        </Field>
        <Field id="new-set-price" label="Price (৳)">
          <Input
            id="new-set-price"
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <div className="md:col-span-2">
          <FilePick
            name="photo"
            accept="image/png,image/webp"
            label="Choose or drop the box photo"
            hint="Transparent PNG or WebP, up to 4 MB"
            onFiles={(f) => setPhoto(f[0] ?? null)}
            className="bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]"
          />
        </div>
        <div className="md:col-span-2">
          <Field id="new-set-alt" label="Photo description" hint="What the box looks like.">
            <Input
              id="new-set-alt"
              value={imageAlt}
              onChange={(e) => setImageAlt(e.target.value)}
            />
          </Field>
        </div>
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button onClick={create} disabled={pending}>
          {pending ? "Creating…" : "Create set"}
        </Button>
      </CardFooter>
    </Card>
  );
}
