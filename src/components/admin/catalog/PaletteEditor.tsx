"use client";

import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { AA_TEXT, contrastRatio } from "@/lib/contrast";

export type PaletteValue = { bg: string; deep: string; accent: string; ink: string };

const FIELDS: { key: keyof PaletteValue; label: string; hint: string }[] = [
  { key: "bg", label: "Background", hint: "The world's main colour" },
  { key: "deep", label: "Deep", hint: "Shadows, floor, far haze" },
  { key: "accent", label: "Accent", hint: "Rim light and details" },
  { key: "ink", label: "Text", hint: "Must read clearly on the background" },
];

const isHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

/** The four colours of a fragrance's world, with a live preview and the readability check */
export function PaletteEditor({
  value,
  onChange,
  name,
  disabled,
}: {
  value: PaletteValue;
  onChange: (v: PaletteValue) => void;
  name: string;
  disabled?: boolean;
}) {
  const ratio = isHex(value.ink) && isHex(value.bg) ? contrastRatio(value.ink, value.bg) : 0;
  const ok = ratio >= AA_TEXT;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_16rem]">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-2">
            <Label htmlFor={`pal-${f.key}`}>{f.label}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`${f.label} colour picker`}
                value={isHex(value[f.key]) ? value[f.key] : "#000000"}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                className="h-9 w-11 shrink-0 cursor-pointer rounded-md border bg-transparent p-1 disabled:cursor-not-allowed"
              />
              <Input
                id={`pal-${f.key}`}
                value={value[f.key]}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value.trim() })}
                aria-invalid={!isHex(value[f.key]) || undefined}
                className="font-mono"
                maxLength={7}
              />
            </div>
            <p className="text-muted-foreground text-xs">{f.hint}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div
          className="flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-lg border p-4"
          style={{
            background: `radial-gradient(120% 90% at 20% 10%, ${value.bg}, ${isHex(value.deep) ? value.deep : value.bg})`,
            color: value.ink,
          }}
          aria-label="Preview of the world"
        >
          <span className="font-display text-3xl leading-none">{name || "Name"}</span>
          <span className="mt-2 h-px w-12" style={{ background: value.accent }} />
          <span className="mt-2 text-xs opacity-80">Eau de parfum · 50 ml</span>
        </div>
        <p
          className={`flex items-center gap-1.5 text-xs ${ok ? "text-[var(--tone-success-fg)]" : "text-[var(--tone-danger-fg)]"}`}
          role="status"
        >
          {ok ? <CheckIcon className="size-3.5" /> : <TriangleAlertIcon className="size-3.5" />}
          Text contrast {ratio.toFixed(1)}:1 {ok ? "(readable)" : `(needs ${AA_TEXT}:1)`}
        </p>
      </div>
    </div>
  );
}
