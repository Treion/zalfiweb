"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ImagePlusIcon,
  PlusIcon,
  SmartphoneIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/admin/ui/alert-dialog";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
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
import { Switch } from "@/components/admin/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { FilePick } from "@/components/admin/catalog/FilePick";
import {
  BANNER_PLACEMENTS,
  PLACEMENT_LABELS,
  isShowing,
  youtubeCover,
  youtubeIdOf,
  type BannerPlacement,
} from "@/lib/content";
import { fromDhakaInput, toDhakaInput } from "@/lib/time";
import type { AdminBanner, AdminVideo } from "@/server/content";
import {
  createBannerAction,
  createVideoAction,
  deleteBannerAction,
  deleteVideoAction,
  moveBannerAction,
  moveVideoAction,
  removeBannerPhoneAction,
  setBannerImageAction,
  updateBannerAction,
  updateVideoAction,
} from "./actions";

type Perfume = { id: number; name: string };

const SIZES =
  "Wide picture: about 2400 × 1000 px (or 16:9). Phone picture: about 1080 × 1350 px (4:5). JPG or WebP, under 4 MB. Banners in one place look best at the same shape.";

const PLACEMENT_HINTS: Record<BannerPlacement, string> = {
  shop: "The first thing on the Shop page. With more than one, shoppers move between them with arrows; they never turn on their own.",
  home: "On the home page, after the scroll through the worlds and before the story. Each one stands on its own, full width.",
};

export function ContentView({
  banners,
  videos,
  perfumes,
  tab,
}: {
  banners: AdminBanner[];
  videos: AdminVideo[];
  perfumes: Perfume[];
  tab: "banners" | "videos";
}) {
  return (
    <Tabs defaultValue={tab}>
      <TabsList>
        <TabsTrigger value="banners">Banners</TabsTrigger>
        <TabsTrigger value="videos">Videos</TabsTrigger>
      </TabsList>
      <TabsContent value="banners" className="flex flex-col gap-10">
        <p className="text-muted-foreground max-w-3xl text-sm">{SIZES}</p>
        {BANNER_PLACEMENTS.map((p) => (
          <Placement key={p} placement={p} banners={banners.filter((b) => b.placement === p)} />
        ))}
      </TabsContent>
      <TabsContent value="videos" className="flex flex-col gap-6">
        <NewVideo perfumes={perfumes} />
        {videos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No videos yet. Nothing shows on the shop until you add one.
          </p>
        ) : (
          videos.map((v, i) => (
            <VideoCard
              key={v.id}
              v={v}
              perfumes={perfumes}
              first={i === 0}
              last={i === videos.length - 1}
            />
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Banners                                                                                          */

function Placement({ placement, banners }: { placement: BannerPlacement; banners: AdminBanner[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{PLACEMENT_LABELS[placement]}</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">{PLACEMENT_HINTS[placement]}</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <PlusIcon /> Add a banner
        </Button>
      </div>
      {banners.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-sm">
          None yet: this part of the shop shows nothing.
        </p>
      ) : (
        banners.map((b, i) => (
          <BannerCard key={b.id} b={b} first={i === 0} last={i === banners.length - 1} />
        ))
      )}
      <NewBanner placement={placement} open={adding} onOpenChange={setAdding} />
    </section>
  );
}

function NewBanner({
  placement,
  open,
  onOpenChange,
}: {
  placement: BannerPlacement;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const form = new FormData();
      form.set("data", JSON.stringify({ placement, alt: alt.trim() }));
      form.set("image", file!);
      const r = await createBannerAction(form);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Banner added. Add words, a link or a phone picture on its card.");
      setFile(null);
      setAlt("");
      onOpenChange(false);
      router.refresh();
    });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a banner: {PLACEMENT_LABELS[placement].toLowerCase()}</DialogTitle>
          <DialogDescription>
            Start with the wide picture. It&rsquo;s shown whole, never cropped.
          </DialogDescription>
        </DialogHeader>
        <FilePick
          name="image"
          accept="image/jpeg,image/png,image/webp,image/avif"
          label="Choose or drop the wide picture"
          hint="JPG, PNG, WebP or AVIF, under 4 MB"
          onFiles={(f) => setFile(f[0] ?? null)}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor={`nb-alt-${placement}`}>What it shows</Label>
          <Input
            id={`nb-alt-${placement}`}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="A model holding Reva against a frosted window"
            maxLength={200}
          />
          <p className="text-muted-foreground text-xs">
            Read aloud to people who can&rsquo;t see it.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!file || alt.trim().length < 3 || pending} onClick={save}>
            {pending ? "Adding…" : "Add banner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BannerForm = {
  alt: string;
  headline: string;
  line: string;
  buttonLabel: string;
  link: string;
  tone: "light" | "dark";
  textInImage: boolean;
  active: boolean;
  startsAt: string;
  endsAt: string;
};

const formOf = (b: AdminBanner): BannerForm => ({
  alt: b.alt,
  headline: b.headline ?? "",
  line: b.line ?? "",
  buttonLabel: b.buttonLabel ?? "",
  link: b.link ?? "",
  tone: b.tone,
  textInImage: b.textInImage,
  active: b.active,
  startsAt: toDhakaInput(b.startsAt),
  endsAt: toDhakaInput(b.endsAt),
});

function BannerCard({ b, first, last }: { b: AdminBanner; first: boolean; last: boolean }) {
  const router = useRouter();
  const [f, setF] = useState<BannerForm>(() => formOf(b));
  const [saved, setSaved] = useState(f);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const set = <K extends keyof BannerForm>(k: K, v: BannerForm[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const showing = isShowing({
    active: saved.active,
    startsAt: fromDhakaInput(saved.startsAt),
    endsAt: fromDhakaInput(saved.endsAt),
  });
  const ids = (k: string) => `b${b.id}-${k}`;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "That didn't work.");
      toast.success(done);
      router.refresh();
    });

  const save = () =>
    start(async () => {
      const r = await updateBannerAction({
        id: b.id,
        details: {
          ...f,
          startsAt: f.startsAt ? fromDhakaInput(f.startsAt) : null,
          endsAt: f.endsAt ? fromDhakaInput(f.endsAt) : null,
        },
      });
      if (!r.ok) return void toast.error(r.error);
      setSaved(f);
      toast.success("Saved. The shop is updated.");
      router.refresh();
    });

  const upload = (which: "wide" | "phone") => (file: File) =>
    run(
      () => {
        const form = new FormData();
        form.set("data", JSON.stringify({ id: b.id, which }));
        form.set("image", file);
        return setBannerImageAction(form);
      },
      which === "wide" ? "Wide picture replaced" : "Phone picture saved",
    );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{saved.headline || saved.alt}</CardTitle>
          <Badge variant={showing ? "default" : "outline"}>
            {showing ? "Showing" : saved.active ? "Outside its dates" : "Off"}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Move up"
            disabled={first || pending}
            onClick={() => run(() => moveBannerAction({ id: b.id, dir: -1 }), "Moved up")}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Move down"
            disabled={last || pending}
            onClick={() => run(() => moveBannerAction({ id: b.id, dir: 1 }), "Moved down")}
          >
            <ArrowDownIcon />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Delete banner">
                <Trash2Icon />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this banner?</AlertDialogTitle>
                <AlertDialogDescription>
                  It leaves the shop at once, with its pictures.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => run(() => deleteBannerAction({ id: b.id }), "Banner deleted")}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-start gap-3">
            <figure className="flex flex-col gap-2">
              <div className="bg-muted relative overflow-hidden rounded-md">
                <Image
                  src={b.image}
                  alt=""
                  width={b.width}
                  height={b.height}
                  sizes="(min-width: 1024px) 40vw, 70vw"
                  className="h-auto w-full"
                />
              </div>
              <figcaption className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                <span>
                  Wide · {b.width} × {b.height}
                </span>
                <PickButton label="Replace" onFile={upload("wide")} disabled={pending} />
              </figcaption>
            </figure>
            <figure className="flex flex-col gap-2">
              {b.mobileImage && b.mobileWidth && b.mobileHeight ? (
                <div className="bg-muted relative overflow-hidden rounded-md">
                  <Image
                    src={b.mobileImage}
                    alt=""
                    width={b.mobileWidth}
                    height={b.mobileHeight}
                    sizes="20vw"
                    className="h-auto w-full"
                  />
                </div>
              ) : (
                <div className="text-muted-foreground flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-md border border-dashed p-2 text-center text-xs">
                  <SmartphoneIcon className="size-4" />
                  Phones use the wide picture
                </div>
              )}
              <figcaption className="text-muted-foreground flex flex-wrap items-center justify-between gap-1 text-xs">
                <span>Phone</span>
                <PickButton
                  label={b.mobileImage ? "Replace" : "Add"}
                  onFile={upload("phone")}
                  disabled={pending}
                />
                {b.mobileImage && (
                  <button
                    type="button"
                    className="hover:text-foreground underline-offset-4 hover:underline"
                    onClick={() =>
                      run(() => removeBannerPhoneAction({ id: b.id }), "Phone picture removed")
                    }
                  >
                    Remove
                  </button>
                )}
              </figcaption>
            </figure>
          </div>
          <Field
            id={ids("alt")}
            label="What it shows"
            hint="Read aloud to people who can't see it."
          >
            <Input
              id={ids("alt")}
              value={f.alt}
              maxLength={200}
              onChange={(e) => set("alt", e.target.value)}
            />
          </Field>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <SwitchRow
            id={ids("textin")}
            label="The words are in the picture"
            hint="The designer put them in: the shop draws none."
            checked={f.textInImage}
            onChange={(v) => set("textInImage", v)}
          />
          {!f.textInImage && (
            <>
              <Field id={ids("headline")} label="Headline (optional)">
                <Input
                  id={ids("headline")}
                  value={f.headline}
                  maxLength={80}
                  placeholder="Reva, at dusk"
                  onChange={(e) => set("headline", e.target.value)}
                />
              </Field>
              <Field id={ids("line")} label="Line under it (optional)">
                <Input
                  id={ids("line")}
                  value={f.line}
                  maxLength={140}
                  onChange={(e) => set("line", e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={ids("button")} label="Button (optional)">
                  <Input
                    id={ids("button")}
                    value={f.buttonLabel}
                    maxLength={30}
                    placeholder="Shop Reva"
                    onChange={(e) => set("buttonLabel", e.target.value)}
                  />
                </Field>
                <Field id={ids("tone")} label="Words in">
                  <Select value={f.tone} onValueChange={(v) => set("tone", v as "light" | "dark")}>
                    <SelectTrigger id={ids("tone")} className="w-full">
                      <SelectValue>
                        {f.tone === "light" ? "Light (dark picture)" : "Dark (light picture)"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light (dark picture)</SelectItem>
                      <SelectItem value="dark">Dark (light picture)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </>
          )}
          <Field
            id={ids("link")}
            label="Leads to (optional)"
            hint="A page on the site, like /fragrances/reva or /discovery, or a full https:// address."
          >
            <Input
              id={ids("link")}
              value={f.link}
              maxLength={300}
              placeholder="/fragrances/reva"
              onChange={(e) => set("link", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={ids("from")} label="From (optional)" hint="Dhaka time">
              <Input
                id={ids("from")}
                type="datetime-local"
                value={f.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
              />
            </Field>
            <Field id={ids("until")} label="Until (optional)" hint="Dhaka time">
              <Input
                id={ids("until")}
                type="datetime-local"
                value={f.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
              />
            </Field>
          </div>
          <SwitchRow
            id={ids("active")}
            label="On the shop"
            checked={f.active}
            onChange={(v) => set("active", v)}
          />
          <div className="flex items-center justify-end gap-3 border-t pt-4">
            {dirty && <span className="text-muted-foreground text-xs">Unsaved changes</span>}
            <Button type="submit" disabled={!dirty || pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Videos                                                                                           */

type VideoForm = {
  url: string;
  title: string;
  channel: string;
  fragranceId: number | null;
  active: boolean;
};

function VideoFields({
  f,
  set,
  perfumes,
  idp,
}: {
  f: VideoForm;
  set: <K extends keyof VideoForm>(k: K, v: VideoForm[K]) => void;
  perfumes: Perfume[];
  idp: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field id={`${idp}-url`} label="YouTube link">
        <Input
          id={`${idp}-url`}
          value={f.url}
          placeholder="https://youtu.be/…"
          maxLength={300}
          onChange={(e) => set("url", e.target.value)}
        />
      </Field>
      <Field id={`${idp}-title`} label="Title">
        <Input
          id={`${idp}-title`}
          value={f.title}
          maxLength={120}
          placeholder="Reva, worn for a week"
          onChange={(e) => set("title", e.target.value)}
        />
      </Field>
      <Field id={`${idp}-channel`} label="Who made it (optional)">
        <Input
          id={`${idp}-channel`}
          value={f.channel}
          maxLength={80}
          onChange={(e) => set("channel", e.target.value)}
        />
      </Field>
      <Field
        id={`${idp}-perfume`}
        label="About"
        hint="Shown on that perfume's page. Every video also shows on the Shop page."
      >
        <Select
          value={f.fragranceId ? String(f.fragranceId) : "none"}
          onValueChange={(v) => set("fragranceId", v === "none" ? null : Number(v))}
        >
          <SelectTrigger id={`${idp}-perfume`} className="w-full">
            <SelectValue>
              {perfumes.find((p) => p.id === f.fragranceId)?.name ?? "The house (no one perfume)"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">The house (no one perfume)</SelectItem>
            {perfumes.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function NewVideo({ perfumes }: { perfumes: Perfume[] }) {
  const router = useRouter();
  const blank: VideoForm = { url: "", title: "", channel: "", fragranceId: null, active: true };
  const [f, setF] = useState<VideoForm>(blank);
  const [pending, start] = useTransition();
  const set = <K extends keyof VideoForm>(k: K, v: VideoForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const id = youtubeIdOf(f.url);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a video</CardTitle>
        <CardDescription>
          A review or a film on YouTube. The shop shows its cover with a play mark; it plays only
          when tapped, inside the page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createVideoAction(f);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Video added");
              setF(blank);
              router.refresh();
            });
          }}
        >
          <div className="grid items-start gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="bg-muted relative aspect-video overflow-hidden rounded-md">
              {id && (
                <Image src={youtubeCover(id)} alt="" fill sizes="192px" className="object-cover" />
              )}
            </div>
            <VideoFields f={f} set={set} perfumes={perfumes} idp="nv" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={!id || !f.title.trim() || pending}>
              {pending ? "Adding…" : "Add video"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function VideoCard({
  v,
  perfumes,
  first,
  last,
}: {
  v: AdminVideo;
  perfumes: Perfume[];
  first: boolean;
  last: boolean;
}) {
  const router = useRouter();
  const initial: VideoForm = {
    url: `https://youtu.be/${v.youtubeId}`,
    title: v.title,
    channel: v.channel ?? "",
    fragranceId: v.fragranceId,
    active: v.active,
  };
  const [f, setF] = useState<VideoForm>(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const set = <K extends keyof VideoForm>(k: K, val: VideoForm[K]) =>
    setF((x) => ({ ...x, [k]: val }));
  const id = youtubeIdOf(f.url) ?? v.youtubeId;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "That didn't work.");
      toast.success(done);
      router.refresh();
    });
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="grid items-start gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <div className="bg-muted relative aspect-video overflow-hidden rounded-md">
              <Image src={youtubeCover(id)} alt="" fill sizes="192px" className="object-cover" />
            </div>
            <Badge variant={saved.active ? "default" : "outline"}>
              {saved.active ? "On the shop" : "Off"}
            </Badge>
          </div>
          <VideoFields f={f} set={set} perfumes={perfumes} idp={`v${v.id}`} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex items-center gap-1">
            <SwitchRow
              id={`v${v.id}-active`}
              label="On the shop"
              checked={f.active}
              onChange={(val) => set("active", val)}
            />
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Move up"
              disabled={first || pending}
              onClick={() => run(() => moveVideoAction({ id: v.id, dir: -1 }), "Moved up")}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Move down"
              disabled={last || pending}
              onClick={() => run(() => moveVideoAction({ id: v.id, dir: 1 }), "Moved down")}
            >
              <ArrowDownIcon />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Delete video">
                  <Trash2Icon />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this video?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It leaves the shop at once. The video stays on YouTube.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => run(() => deleteVideoAction({ id: v.id }), "Video deleted")}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              disabled={!dirty || pending}
              onClick={() =>
                start(async () => {
                  const r = await updateVideoAction({ id: v.id, video: f });
                  if (!r.ok) return void toast.error(r.error);
                  setSaved(f);
                  toast.success("Saved. The shop is updated.");
                  router.refresh();
                })
              }
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
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

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** A small button that opens the file chooser and hands over the picture */
function PickButton({
  label,
  onFile,
  disabled,
}: {
  label: string;
  onFile: (f: File) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="hover:text-foreground inline-flex items-center gap-1 underline-offset-4 hover:underline disabled:opacity-50"
      >
        <ImagePlusIcon className="size-3.5" /> {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        aria-label={label}
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
