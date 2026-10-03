"use client";

import { UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/admin/lib/utils";

/**
 * A drop zone / file chooser with a preview. Click, or drag a file onto it. `accept` limits the
 * types; the server checks everything again.
 */
export function FilePick({
  name,
  accept,
  multiple,
  label,
  hint,
  onFiles,
  className,
  preview = true,
}: {
  name: string;
  accept: string;
  multiple?: boolean;
  label: string;
  hint?: string;
  onFiles?: (files: File[]) => void;
  className?: string;
  preview?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (preview) setUrls(files.map((f) => URL.createObjectURL(f)));
    onFiles?.(files);
  };

  return (
    <div
      className={cn(
        "hover:border-ring relative flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center transition-colors",
        over && "border-ring bg-muted/50",
        className,
      )}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (input.current && e.dataTransfer.files.length) {
          input.current.files = e.dataTransfer.files;
          take(e.dataTransfer.files);
        }
      }}
    >
      <input
        ref={input}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        className="sr-only"
        aria-label={label}
        onChange={(e) => take(e.target.files)}
      />
      {urls.length ? (
        <div className="flex flex-wrap justify-center gap-2">
          {urls.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element -- a local, not-yet-uploaded preview
            <img key={u} src={u} alt="" className="max-h-40 rounded-md object-contain" />
          ))}
        </div>
      ) : (
        <>
          <UploadIcon className="text-muted-foreground size-5" />
          <span className="text-sm font-medium">{label}</span>
          {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
        </>
      )}
    </div>
  );
}
