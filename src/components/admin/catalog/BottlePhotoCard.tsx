"use client";

import Image from "next/image";
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
import { replaceBottleAction } from "@/app/(admin)/admin/(app)/products/actions";
import { FilePick } from "./FilePick";

/** The hero bottle photo: replacing it re-bakes the 3D lighting maps from the new photo */
export function BottlePhotoCard({
  id,
  src,
  alt,
  bg,
}: {
  id: number;
  src: string;
  alt: string;
  bg: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [current, setCurrent] = useState(src);
  const [key, setKey] = useState(0);
  const [pending, start] = useTransition();

  function upload() {
    if (!file) return;
    const form = new FormData();
    form.set("data", JSON.stringify({ id }));
    form.set("photo", file);
    start(async () => {
      const res = await replaceBottleAction(form);
      if (!res.ok) return void toast.error(res.error);
      setCurrent(res.data.url);
      setFile(null);
      setKey((k) => k + 1);
      toast.success("New bottle photo is live, lit in 3D.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bottle photo</CardTitle>
        <CardDescription>
          The real bottle, cut out on a transparent background. The shop lights it in 3D.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-[14rem_1fr]">
        <div
          className="relative aspect-square overflow-hidden rounded-lg border"
          style={{ background: bg }}
        >
          <Image src={current} alt={alt} fill sizes="224px" className="object-contain" />
        </div>
        <FilePick
          key={key}
          name="photo"
          accept="image/png,image/webp"
          label="Choose or drop a new photo"
          hint="Transparent PNG, ideally 2000 × 2000 px, up to 4 MB"
          onFiles={(f) => setFile(f[0] ?? null)}
          className="bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]"
        />
      </CardContent>
      {file && (
        <CardFooter className="justify-end gap-3 border-t">
          <span className="text-muted-foreground mr-auto text-xs">
            Replaces the photo on the shop straight away.
          </span>
          <Button
            variant="outline"
            onClick={() => (setFile(null), setKey((k) => k + 1))}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={upload} disabled={pending}>
            {pending ? "Preparing the bottle…" : "Use this photo"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
