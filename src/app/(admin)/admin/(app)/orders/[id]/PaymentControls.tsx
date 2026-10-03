"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCwIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import { formatPrice, poishaToTaka, takaToPoisha } from "@/lib/money";
import { refreshRefundAction, refundAction } from "../actions";

/** Refund part or all of what is left. Online payments go back through the provider. */
export function RefundButton({
  orderId,
  number,
  left,
  manual,
}: {
  orderId: number;
  number: string;
  /** Poisha left to refund */
  left: number;
  /** Cash on delivery: paid back by hand, only recorded here */
  manual: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [taka, setTaka] = useState(String(poishaToTaka(left)));
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const amount = takaToPoisha(Number(taka) || 0);
  const valid = amount >= 100 && amount <= left && reason.trim().length >= 3;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Undo2Icon /> Refund
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`Refund ${number}`}</DialogTitle>
            <DialogDescription>
              {manual
                ? "Cash on delivery: pay the customer back by hand (cash, bKash or Nagad), then record it here."
                : "The refund goes back to the customer's card or wallet through the payment provider. It can take a few days to arrive."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="refund-amount">Amount (৳)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="refund-amount"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={poishaToTaka(left)}
                  step="0.01"
                  value={taka}
                  onChange={(e) => setTaka(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTaka(String(poishaToTaka(left)))}
                >
                  All
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">{`Up to ${formatPrice(left)}.`}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="refund-reason">Reason (on the timeline)</Label>
              <Textarea
                id="refund-reason"
                rows={2}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep the money
            </Button>
            <Button
              variant="destructive"
              disabled={!valid || pending}
              onClick={() =>
                start(async () => {
                  const r = await refundAction({ id: orderId, amount, reason });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(
                    r.data.status === "completed"
                      ? `${formatPrice(amount)} refunded`
                      : r.data.status === "pending"
                        ? `${formatPrice(amount)} refund sent, processing`
                        : "The provider refused the refund. See the timeline.",
                  );
                  setOpen(false);
                  setReason("");
                  router.refresh();
                })
              }
            >
              {manual ? `Record ${formatPrice(amount)} refund` : `Refund ${formatPrice(amount)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RefreshRefund({ refundId, orderId }: { refundId: number; orderId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await refreshRefundAction({ refundId, orderId });
          if (!r.ok) return void toast.error(r.error);
          toast.success(
            r.data.status === "pending" ? "Still processing" : `Refund ${r.data.status}`,
          );
          router.refresh();
        })
      }
    >
      <RefreshCwIcon /> Check
    </Button>
  );
}
