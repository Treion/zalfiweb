import Image from "next/image";
import clsx from "clsx";
import type { Note } from "@/lib/fragrance";
import { AssetFrame } from "./AssetFrame";

type Props = {
  note: Pick<Note, "image" | "alt" | "name">;
  /** Resolved on the server with lib/assets.ts; false renders the empty frame */
  available: boolean;
  label?: string;
  /** Show the ingredient name inside the empty frame (off where a caption already names it) */
  frameLabel?: boolean;
  sizes: string;
  className?: string;
};

/** A note ingredient image, or its empty frame while the photo is pending. */
export function NoteImage({ note, available, label, frameLabel = true, sizes, className }: Props) {
  const filename = note.image.split("/").pop()!;
  if (!available)
    return (
      <AssetFrame
        filename={filename}
        label={frameLabel ? (label ?? note.name) : undefined}
        ariaLabel={label ?? note.name}
        className={className}
      />
    );
  return (
    <div className={clsx("relative aspect-square w-full", className)}>
      <Image src={note.image} alt={note.alt} fill sizes={sizes} className="object-contain" />
    </div>
  );
}
