"use client";

import Image from "next/image";
import { GripVerticalIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
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
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import {
  addImagesAction,
  deleteImageAction,
  reorderImagesAction,
  updateImageAltAction,
} from "@/app/(admin)/admin/(app)/products/actions";
import { FilePick } from "./FilePick";

type Img = { id: number; url: string; alt: string };

function AltField({ img, fragranceId }: { img: Img; fragranceId: number }) {
  const [alt, setAlt] = useState(img.alt);
  const [saved, setSaved] = useState(img.alt);
  const [pending, start] = useTransition();
  const save = () => {
    if (alt === saved) return;
    start(async () => {
      const res = await updateImageAltAction({ imageId: img.id, fragranceId, alt });
      if (!res.ok) {
        toast.error(res.error);
        return setAlt(saved);
      }
      setSaved(alt);
      toast.success("Description saved");
    });
  };
  return (
    <Input
      value={alt}
      onChange={(e) => setAlt(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      aria-label="Image description"
      disabled={pending}
      className="h-8 text-xs"
      maxLength={200}
    />
  );
}

/** Gallery photos: upload several, drag to reorder, describe each, remove */
export function ImagesEditor({ fragranceId, images }: { fragranceId: number; images: Img[] }) {
  const [order, setOrder] = useState(images);
  const [dragging, setDragging] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pickKey, setPickKey] = useState(0);
  const [pending, start] = useTransition();

  // Keep the local order in step when the server sends a new list (after an upload or delete)
  const ids = images.map((i) => i.id).join(",");
  const [seen, setSeen] = useState(ids);
  if (ids !== seen) {
    setSeen(ids);
    setOrder(images);
  }

  function upload() {
    const form = new FormData();
    form.set("data", JSON.stringify({ id: fragranceId, alt: "" }));
    for (const f of files) form.append("images", f);
    start(async () => {
      const res = await addImagesAction(form);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${res.data.added} image${res.data.added > 1 ? "s" : ""} added`);
      setFiles([]);
      setPickKey((k) => k + 1);
    });
  }

  function drop(target: number, moving: number | null = dragging) {
    if (moving === null || moving === target) return;
    const next = [...order];
    const from = next.findIndex((i) => i.id === moving);
    const to = next.findIndex((i) => i.id === target);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setOrder(next);
    setDragging(null);
    start(async () => {
      const res = await reorderImagesAction({ fragranceId, order: next.map((i) => i.id) });
      if (!res.ok) {
        toast.error(res.error);
        setOrder(images);
      }
    });
  }

  const move = (id: number, by: number) => {
    const i = order.findIndex((x) => x.id === id);
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    drop(order[j]!.id, id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gallery</CardTitle>
        <CardDescription>
          Extra photos for the product page and receipts. Drag to reorder (or use the arrow keys on
          the handle).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {order.length > 0 && (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {order.map((img, i) => (
              <li
                key={img.id}
                draggable
                onDragStart={() => setDragging(img.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(img.id)}
                className={`bg-card flex flex-col gap-2 rounded-lg border p-2 ${dragging === img.id ? "opacity-50" : ""}`}
              >
                <div className="bg-muted relative aspect-square overflow-hidden rounded-md">
                  <Image
                    src={img.url}
                    alt={img.alt}
                    fill
                    sizes="(min-width: 1280px) 20vw, 45vw"
                    className="object-cover"
                  />
                  <span className="bg-background/80 absolute top-1.5 left-1.5 rounded px-1.5 text-xs tabular-nums">
                    {i + 1}
                  </span>
                </div>
                <AltField img={img} fragranceId={fragranceId} />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground cursor-grab rounded p-1"
                    aria-label={`Move image ${i + 1}: use arrow keys`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                        e.preventDefault();
                        move(img.id, -1);
                      }
                      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                        e.preventDefault();
                        move(img.id, 1);
                      }
                    }}
                  >
                    <GripVerticalIcon className="size-4" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete image"
                        disabled={pending}
                      >
                        <Trash2Icon />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this image?</AlertDialogTitle>
                        <AlertDialogDescription>
                          It disappears from the shop at once.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() =>
                            start(async () => {
                              const res = await deleteImageAction({ imageId: img.id, fragranceId });
                              if (!res.ok) toast.error(res.error);
                              else toast.success("Image deleted");
                            })
                          }
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-3">
          <FilePick
            key={pickKey}
            name="images"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            label={order.length ? "Add more photos" : "Choose or drop photos"}
            hint="JPG, PNG, WebP or AVIF, up to 4 MB each, 8 at a time"
            onFiles={setFiles}
          />
          {files.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => (setFiles([]), setPickKey((k) => k + 1))}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={upload} disabled={pending}>
                {pending
                  ? "Uploading…"
                  : `Upload ${files.length} photo${files.length > 1 ? "s" : ""}`}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
