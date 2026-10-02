import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { Button } from "@/components/admin/ui/button";

export default function AdminNotFound() {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Nothing here"
      action={
        <Button asChild variant="outline">
          <Link href="/admin">Back to the overview</Link>
        </Button>
      }
    >
      The page or record you were looking for doesn&rsquo;t exist, or was removed.
    </EmptyState>
  );
}
