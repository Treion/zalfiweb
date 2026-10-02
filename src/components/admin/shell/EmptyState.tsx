import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/admin/lib/utils";

/** A calm empty state: an icon, one line of what goes here, and what to do next */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      <div className="bg-muted mb-4 grid size-11 place-items-center rounded-full">
        <Icon className="text-muted-foreground size-5" />
      </div>
      <p className="font-medium">{title}</p>
      {children && <div className="text-muted-foreground mt-1 max-w-sm text-sm">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
