"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2Icon } from "lucide-react";
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
import { deleteCouponAction } from "../actions";

/** Delete a coupon nobody has used. A used one stays on record (switch it off instead). */
export function CouponDanger({ id, code, used }: { id: number; code: string; used: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (used) return null;
  return (
    <div className="mt-6 flex justify-end">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="text-destructive">
            <Trash2Icon /> Delete coupon
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Nobody has used it yet, so nothing else changes. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteCouponAction({ id });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(`${code} deleted`);
                  router.push("/admin/coupons");
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
