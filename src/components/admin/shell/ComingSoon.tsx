import { HourglassIcon } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";

/** A section that a later build phase fills in (see docs/BACKEND_PLAN.md) */
export function ComingSoon({
  title,
  phase,
  children,
}: {
  title: string;
  phase: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={HourglassIcon} title={`Arrives in phase ${phase}`}>
        {children}
      </EmptyState>
    </>
  );
}
