import Link from "next/link";
import { LockIcon } from "lucide-react";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { Button } from "@/components/admin/ui/button";

export default function AdminForbidden() {
  return (
    <EmptyState
      icon={LockIcon}
      title="This page is for the owner"
      action={
        <Button asChild variant="outline">
          <Link href="/admin">Back to the overview</Link>
        </Button>
      }
    >
      Your role doesn&rsquo;t include it. Ask the owner if you need access.
    </EmptyState>
  );
}
