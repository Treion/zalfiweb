"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { createNoteAction } from "@/app/(admin)/admin/(app)/notes/actions";
import { FilePick } from "./FilePick";

export type CreatedNote = { id: number; slug: string; name: string; image: string };

/**
 * A new note for the library: its name, its photo (transparent background) and a few words
 * describing the photo. Used on the Notes page and from a fragrance's notes editor, which adds
 * the new note to its pyramid at once.
 */
export function NewNoteDialog({
  open,
  onOpenChange,
  onCreated,
  initialName = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (note: CreatedNote) => void;
  initialName?: string;
}) {
  const [name, setName] = useState(initialName);
  const [alt, setAlt] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const ready = name.trim().length >= 2 && alt.trim().length >= 6 && !!photo;

  const reset = () => {
    setName(initialName);
    setAlt("");
    setPhoto(null);
  };

  const save = () =>
    start(async () => {
      const form = new FormData();
      form.set("data", JSON.stringify({ name: name.trim(), alt: alt.trim() }));
      form.set("photo", photo!);
      const r = await createNoteAction(form);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${r.data.name} added to the notes`);
      onCreated?.(r.data);
      reset();
      onOpenChange(false);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
          <DialogDescription>
            An ingredient any fragrance can use. Each fragrance can name it its own way.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-name">Name</Label>
            <Input
              id="note-name"
              value={name}
              maxLength={40}
              placeholder="Bergamot"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Photo</Label>
            {/* Reopened with a fresh key, so a cancelled pick doesn't linger */}
            <FilePick
              key={open ? "open" : "closed"}
              name="photo"
              accept="image/png,image/webp,image/avif"
              label="Choose or drop a photo"
              hint="PNG or WebP with a transparent background, up to 4 MB. It's trimmed and centred for you."
              onFiles={(f) => setPhoto(f[0] ?? null)}
              className="bg-muted/40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-alt">Describe the photo</Label>
            <Input
              id="note-alt"
              value={alt}
              maxLength={160}
              placeholder="A halved bergamot with its leaves"
              onChange={(e) => setAlt(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">Read aloud to people who can&rsquo;t see it.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!ready || pending} onClick={save}>
            {pending ? "Adding…" : "Add note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
