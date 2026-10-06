"use client";

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
import { Checkbox } from "@/components/admin/ui/checkbox";
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
import {
  BADGE_LABELS,
  BADGES,
  HOW_TO_WEAR,
  MOMENTS,
  SEASONS,
  type Badge,
  type ScentProfile,
} from "@/lib/fragrance";
import { CAP_FINISHES, fragranceDetailsSchema } from "@/server/catalog/schema";
import { updateDetailsAction } from "@/app/(admin)/admin/(app)/products/actions";
import { CAP_LABELS } from "./labels";
import { PaletteEditor, type PaletteValue } from "./PaletteEditor";

export type Details = {
  name: string;
  tagline: string;
  mood: string;
  story: string;
  bottleAlt: string;
  capFinish: (typeof CAP_FINISHES)[number];
  palette: PaletteValue;
  profile: ScentProfile | null;
  sortOrder: number;
  published: boolean;
  badge: Badge | null;
  howToWear: string;
};

const EMPTY_PROFILE: ScentProfile = {
  family: "",
  longevity: 3,
  sillage: 3,
  seasons: [],
  moments: [],
};
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function Field({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function Scale({
  id,
  value,
  onChange,
  low,
  high,
}: {
  id: string;
  value: number;
  onChange: (n: 1 | 2 | 3 | 4 | 5) => void;
  low: string;
  high: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1" role="radiogroup" aria-labelledby={id}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n as 1 | 2 | 3 | 4 | 5)}
            className={`h-8 flex-1 rounded-md border text-sm transition-colors ${value === n ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="text-muted-foreground flex justify-between text-[0.7rem]">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/** Everything about a fragrance except its photo, sizes, notes and gallery */
export function DetailsForm({ id, initial }: { id: number; initial: Details }) {
  const [d, setD] = useState<Details>(initial);
  const [saved, setSaved] = useState<Details>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const set = <K extends keyof Details>(k: K, v: Details[K]) => setD((x) => ({ ...x, [k]: v }));
  const profile = d.profile ?? EMPTY_PROFILE;
  const setProfile = (p: Partial<ScentProfile>) => set("profile", { ...profile, ...p });

  function save() {
    const check = fragranceDetailsSchema.safeParse(d);
    if (!check.success) {
      const i = check.error.issues[0];
      return setError(i ? `${i.path.join(" › ") || "Form"}: ${i.message}` : "Check the form.");
    }
    setError(null);
    start(async () => {
      const res = await updateDetailsAction({ id, details: check.data });
      if (!res.ok) {
        setError(res.error);
        return void toast.error(res.error);
      }
      setSaved(d);
      toast.success(
        d.published && !saved.published
          ? `${d.name} is now on the shop`
          : "Saved. The shop is updated.",
      );
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Words</CardTitle>
          <CardDescription>
            Short and sensory: the shop shows the name, tagline and mood.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field id="d-name" label="Name">
            <Input
              id="d-name"
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={40}
            />
          </Field>
          <Field id="d-mood" label="Mood" hint="A few words, shown as the world's label">
            <Input
              id="d-mood"
              value={d.mood}
              onChange={(e) => set("mood", e.target.value)}
              maxLength={60}
            />
          </Field>
          <div className="md:col-span-2">
            <Field id="d-tagline" label="Tagline">
              <Input
                id="d-tagline"
                value={d.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                maxLength={140}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              id="d-story"
              label="Story"
              hint="On the product page under About (folded until opened); search engines read it too."
            >
              <Textarea
                id="d-story"
                rows={4}
                value={d.story}
                onChange={(e) => set("story", e.target.value)}
                maxLength={2000}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              id="d-wear"
              label="How to wear it"
              hint="On the product page, folded. Leave empty for the house's plain advice."
            >
              <Textarea
                id="d-wear"
                rows={3}
                value={d.howToWear}
                placeholder={HOW_TO_WEAR}
                onChange={(e) => set("howToWear", e.target.value)}
                maxLength={600}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              id="d-alt"
              label="Bottle description"
              hint="Read aloud to people who can't see the photo."
            >
              <Input
                id="d-alt"
                value={d.bottleAlt}
                onChange={(e) => set("bottleAlt", e.target.value)}
                maxLength={200}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>World and cap</CardTitle>
          <CardDescription>The colours the shop takes on for this fragrance.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <PaletteEditor value={d.palette} onChange={(p) => set("palette", p)} name={d.name} />
          <div className="max-w-xs">
            <Field id="d-cap" label="Cap">
              <Select
                value={d.capFinish}
                onValueChange={(v) => set("capFinish", v as Details["capFinish"])}
              >
                <SelectTrigger id="d-cap" className="w-full">
                  <SelectValue>{CAP_LABELS[d.capFinish]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CAP_FINISHES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CAP_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scent profile</CardTitle>
          <CardDescription>
            Shown on the product page as &ldquo;The character&rdquo;.
          </CardDescription>
          <div data-slot="card-action" className="flex items-center gap-2">
            <Label htmlFor="d-profile-on" className="text-muted-foreground text-xs">
              Show
            </Label>
            <Switch
              id="d-profile-on"
              checked={!!d.profile}
              onCheckedChange={(on) => set("profile", on ? (d.profile ?? EMPTY_PROFILE) : null)}
            />
          </div>
        </CardHeader>
        {d.profile && (
          <CardContent className="grid gap-5 md:grid-cols-2">
            <Field id="d-family" label="Family">
              <Input
                id="d-family"
                value={profile.family}
                onChange={(e) => setProfile({ family: e.target.value })}
                placeholder="Aromatic fougère"
              />
            </Field>
            <div />
            <div className="flex flex-col gap-2">
              <Label id="d-longevity">Longevity</Label>
              <Scale
                id="d-longevity"
                value={profile.longevity}
                onChange={(n) => setProfile({ longevity: n })}
                low="A few hours"
                high="Into the next day"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label id="d-sillage">Sillage</Label>
              <Scale
                id="d-sillage"
                value={profile.sillage}
                onChange={(n) => setProfile({ sillage: n })}
                low="Close to the skin"
                high="Fills the room"
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Seasons</legend>
              <div className="flex flex-wrap gap-4">
                {SEASONS.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={profile.seasons.includes(s)}
                      onCheckedChange={(c) =>
                        setProfile({
                          seasons: c
                            ? [...profile.seasons, s]
                            : profile.seasons.filter((x) => x !== s),
                        })
                      }
                    />
                    {cap(s)}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Moments</legend>
              <div className="flex flex-wrap gap-4">
                {MOMENTS.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={profile.moments.includes(m)}
                      onCheckedChange={(c) =>
                        setProfile({
                          moments: c
                            ? [...profile.moments, m]
                            : profile.moments.filter((x) => x !== m),
                        })
                      }
                    />
                    {cap(m)}
                  </label>
                ))}
              </div>
            </fieldset>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>On the shop</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="flex items-start justify-between gap-6">
            <div>
              <Label htmlFor="d-published">Published</Label>
              <p className="text-muted-foreground mt-1 text-xs">
                Hidden fragrances aren&rsquo;t shown or sold.
              </p>
            </div>
            <Switch
              id="d-published"
              checked={d.published}
              onCheckedChange={(v) => set("published", v)}
            />
          </div>
          <Field
            id="d-badge"
            label="Badge"
            hint="A word on its card in the shop and above its name."
          >
            <Select
              value={d.badge ?? "none"}
              onValueChange={(v) => set("badge", v === "none" ? null : (v as Badge))}
            >
              <SelectTrigger id="d-badge" className="w-full max-w-56">
                <SelectValue>{d.badge ? BADGE_LABELS[d.badge] : "None"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {BADGES.map((b) => (
                  <SelectItem key={b} value={b}>
                    {BADGE_LABELS[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="d-order" label="Order in the collection" hint="Lower numbers come first.">
            <Input
              id="d-order"
              type="number"
              min={0}
              max={999}
              value={d.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
              className="max-w-28"
            />
          </Field>
        </CardContent>
        <CardFooter className="justify-end gap-3 border-t">
          {error && (
            <p role="alert" className="text-destructive mr-auto text-sm">
              {error}
            </p>
          )}
          {dirty && <span className="text-muted-foreground text-xs">Unsaved changes</span>}
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
