"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FilePick } from "@/components/admin/catalog/FilePick";
import { CAP_LABELS } from "@/components/admin/catalog/labels";
import { PaletteEditor, type PaletteValue } from "@/components/admin/catalog/PaletteEditor";
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
import { CAP_FINISHES, newFragranceSchema } from "@/server/catalog/schema";
import { createFragranceAction } from "../actions";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

export function NewFragranceForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagline, setTagline] = useState("");
  const [mood, setMood] = useState("");
  const [cap, setCap] = useState<(typeof CAP_FINISHES)[number]>("black");
  const [palette, setPalette] = useState<PaletteValue>({
    bg: "#1d1b19",
    deep: "#0b0a09",
    accent: "#c9a46a",
    ink: "#efeae1",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const data = { name, slug: slug || slugify(name), tagline, mood, capFinish: cap, palette };
    const check = newFragranceSchema.safeParse(data);
    if (!check.success) {
      const i = check.error.issues[0];
      return setError(i ? `${String(i.path[0] ?? "")}: ${i.message}` : "Check the form.");
    }
    if (!photo) return setError("Add the bottle photo (a transparent PNG).");
    setError(null);
    const form = new FormData();
    form.set("data", JSON.stringify(check.data));
    form.set("photo", photo);
    start(async () => {
      const res = await createFragranceAction(form);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`${name} created. Add its sizes and notes next.`);
      router.push(`/admin/products/${res.data.id}?tab=sizes`);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>The essentials</CardTitle>
          <CardDescription>
            You can change all of this later, except the web address.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nf-name">Name</Label>
            <Input
              id="nf-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              required
              maxLength={40}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nf-slug">Web address</Label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground shrink-0">/fragrances/</span>
              <Input
                id="nf-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="nf-tagline">Tagline</Label>
            <Input
              id="nf-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={140}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nf-mood">Mood (a few words)</Label>
            <Input
              id="nf-mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              maxLength={60}
              required
              placeholder="Warm sand and cream"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nf-cap">Cap</Label>
            <Select value={cap} onValueChange={(v) => setCap(v as typeof cap)}>
              <SelectTrigger id="nf-cap" className="w-full">
                <SelectValue>{CAP_LABELS[cap]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CAP_FINISHES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CAP_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Its world</CardTitle>
          <CardDescription>
            The colours the shop takes on in this fragrance&rsquo;s chapter and page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaletteEditor value={palette} onChange={setPalette} name={name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bottle photo</CardTitle>
          <CardDescription>
            A transparent PNG of the real bottle, ideally 2000 × 2000 px, up to 4 MB. The shop
            lights it in 3D from this photo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FilePick
            name="photo"
            accept="image/png,image/webp"
            label="Choose or drop the bottle photo"
            hint="PNG with a transparent background"
            onFiles={(f) => setPhoto(f[0] ?? null)}
            className="bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]"
          />
        </CardContent>
        <CardFooter className="justify-end gap-3 border-t">
          {error && (
            <p role="alert" className="text-destructive mr-auto text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Preparing the bottle…" : "Create fragrance"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
