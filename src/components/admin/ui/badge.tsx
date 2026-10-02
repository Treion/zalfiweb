import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/components/admin/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent",
        secondary: "bg-secondary text-secondary-foreground border-transparent",
        destructive: "bg-destructive text-destructive-foreground border-transparent",
        outline: "text-foreground",
        neutral: "border-transparent bg-[var(--tone-neutral-bg)] text-[var(--tone-neutral-fg)]",
        info: "border-transparent bg-[var(--tone-info-bg)] text-[var(--tone-info-fg)]",
        progress: "border-transparent bg-[var(--tone-progress-bg)] text-[var(--tone-progress-fg)]",
        success: "border-transparent bg-[var(--tone-success-bg)] text-[var(--tone-success-fg)]",
        warning: "border-transparent bg-[var(--tone-warning-bg)] text-[var(--tone-warning-fg)]",
        danger: "border-transparent bg-[var(--tone-danger-bg)] text-[var(--tone-danger-fg)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
