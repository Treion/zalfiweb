"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LeafIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FilePick } from "@/components/admin/catalog/FilePick";
import { NewNoteDialog } from "@/components/admin/catalog/NewNoteDialog";
import { EmptyState } from "@/components/admin/shell/EmptyState";
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
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/admin/ui/sheet";
import type { NoteAdmin } from "@/server/catalog/notes";
import { deleteNoteAction, replaceNotePhotoAction, updateNoteAction } from "./actions";

export function NewNoteButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> New note
      </Button>
      <NewNoteDialog open={open} onOpenChange={setOpen} onCreated={() => router.refresh()} />
    </>
  );
}

/** The photo on a quiet tile, so its transparent background reads */
function Photo({ n, sizes, className }: { n: NoteAdmin; sizes: string; className?: string }) {
  return (
    <div
      className={`bg-muted relative aspect-square overflow-hidden rounded-md ${className ?? ""}`}
    >
      <Image src={n.image} alt={n.alt} fill sizes={sizes} className="object-contain p-3" />
    </div>
  );
}

const usedLine = (n: NoteAdmin) =>
  n.usedIn.length
    ? n.usedIn.map((u) => `${u.fragrance} · ${u.layer}`).join(", ")
    : "Not in a fragrance yet";

function EditSheet({ n, onClose }: { n: NoteAdmin; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(n.name);
  const [alt, setAlt] = useState(n.alt);
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const dirty = name.trim() !== n.name || alt.trim() !== n.alt;

  const save = () =>
    start(async () => {
      const r = await updateNoteAction({ id: n.id, name: name.trim(), alt: alt.trim() });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      router.refresh();
    });

  const upload = () =>
    start(async () => {
      const form = new FormData();
      form.set("data", JSON.stringify({ id: n.id }));
      form.set("photo", photo!);
      const r = await replaceNotePhotoAction(form);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Photo replaced");
      setPhoto(null);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const r = await deleteNoteAction({ id: n.id });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${n.name} deleted`);
      onClose();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <SheetTitle className="font-display text-2xl">{n.name}</SheetTitle>
        <p className="text-muted-foreground mt-1 font-mono text-xs">{n.slug}</p>
      </div>

      <section className="flex flex-col gap-3">
        <Photo n={n} sizes="320px" className="w-full max-w-xs" />
        <FilePick
          key={n.image}
          name="photo"
          accept="image/png,image/webp,image/avif"
          label="Replace the photo"
          hint="PNG or WebP with a transparent background, up to 4 MB."
          onFiles={(f) => setPhoto(f[0] ?? null)}
          className="min-h-24"
        />
        {photo && (
          <div>
            <Button size="sm" disabled={pending} onClick={upload}>
              Use this photo
            </Button>
          </div>
        )}
      </section>

      <form
        className="flex flex-col gap-4 border-t pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-name">Name</Label>
          <Input
            id="edit-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Each fragrance shows its own wording (e.g. &ldquo;Crushed Wild Mint&rdquo;), set in
            Products → Notes.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-alt">Describe the photo</Label>
          <Input
            id="edit-alt"
            value={alt}
            maxLength={160}
            onChange={(e) => setAlt(e.target.value)}
          />
        </div>
        <div>
          <Button type="submit" disabled={!dirty || pending}>
            Save
          </Button>
        </div>
      </form>

      <section className="flex flex-col gap-2 border-t pt-5 text-sm">
        <h3 className="font-medium">In fragrances</h3>
        {n.usedIn.length ? (
          <ul className="flex flex-col gap-1">
            {n.usedIn.map((u) => (
              <li key={`${u.fragranceId}-${u.layer}`}>
                <Link
                  href={`/admin/products/${u.fragranceId}?tab=notes`}
                  className="underline-offset-4 hover:underline"
                >
                  {u.fragrance}
                </Link>{" "}
                <span className="text-muted-foreground">
                  · {u.layer} · &ldquo;{u.label}&rdquo;
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Not in a fragrance yet.</p>
        )}
      </section>

      <section className="border-t pt-5">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={pending || n.usedIn.length > 0}>
              <Trash2Icon /> Delete note
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{`Delete ${n.name}?`}</AlertDialogTitle>
              <AlertDialogDescription>
                It leaves the notes library, with its photo. This can&rsquo;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {n.usedIn.length > 0 && (
          <p className="text-muted-foreground mt-2 text-xs">
            Take it out of {n.usedIn.length > 1 ? "those fragrances" : "that fragrance"} first.
          </p>
        )}
      </section>
    </div>
  );
}

export function NotesView({ notes }: { notes: NoteAdmin[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = notes.find((n) => n.id === openId) ?? null;
  if (!notes.length)
    return (
      <EmptyState icon={LeafIcon} title="No notes yet" action={<NewNoteButton />}>
        Add the ingredients your fragrances are made of, each with a photo.
      </EmptyState>
    );
  return (
    <>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {notes.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => setOpenId(n.id)}
              className="group hover:border-ring focus-visible:ring-ring/50 flex w-full flex-col gap-2 rounded-lg border p-2 text-left transition-colors outline-none focus-visible:ring-[3px]"
            >
              <Photo n={n} sizes="(min-width: 1280px) 200px, (min-width: 640px) 30vw, 45vw" />
              <span className="px-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{n.name}</span>
                  {!n.usedIn.length && <Badge variant="neutral">Unused</Badge>}
                </span>
                <span className="text-muted-foreground line-clamp-2 text-xs">{usedLine(n)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && <EditSheet key={open.id} n={open} onClose={() => setOpenId(null)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
