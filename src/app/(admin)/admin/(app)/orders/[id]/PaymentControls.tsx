"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckIcon, HandCoinsIcon, RefreshCwIcon, Undo2Icon, XIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { formatPrice, poishaToTaka, takaToPoisha } from "@/lib/money";
import {
  confirmManualPaymentAction,
  recordPaymentAction,
  refreshRefundAction,
  refundAction,
  rejectManualPaymentAction,
} from "../actions";

const REFUND_HOW = {
  api: "The refund goes back to the customer's card or wallet through SSLCommerz. It can take a few days to arrive.",
  panel:
    "aamarPay has no refund API: make the refund in the aamarPay merchant panel first, then record it here.",
  hand: "Pay the customer back yourself (cash, bKash or Nagad), then record it here.",
} as const;

/**
 * Refund part or all of what is left. SSLCommerz payments go back through SSLCommerz; aamarPay
 * refunds are made in its panel, and anything paid by hand is paid back by hand: both are recorded.
 */
export function RefundButton({
  orderId,
  number,
  left,
  mode,
}: {
  orderId: number;
  number: string;
  /** Poisha left to refund */
  left: number;
  /** How this order's money goes back (refundModeOf) */
  mode: "api" | "panel" | "hand";
}) {
  const manual = mode !== "api";
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
            <DialogDescription>{REFUND_HOW[mode]}</DialogDescription>
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

/**
 * A bKash or Nagad payment the customer says they made: check it in the wallet app, then confirm
 * it (the order is confirmed and its bottles sold) or say it wasn't there (the customer can try
 * again).
 */
export function ManualCheck({
  paymentId,
  amount,
  wallet,
  trxId,
}: {
  paymentId: number;
  amount: number;
  wallet: string;
  trxId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setConfirming(true)} disabled={pending}>
          <CheckIcon /> Payment received
        </Button>
        <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={pending}>
          <XIcon /> Not found
        </Button>
      </div>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm the {wallet} payment</DialogTitle>
            <DialogDescription>
              {`Check your ${wallet} app for transaction ${trxId}: ${formatPrice(amount)} received. Confirming marks the order paid, sells its bottles and emails the receipt.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-note">Note (optional, on the timeline)</Label>
            <Textarea
              id="confirm-note"
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Not yet
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await confirmManualPaymentAction({ paymentId, amount, note });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Payment confirmed: the order is confirmed");
                  setConfirming(false);
                  router.refresh();
                })
              }
            >
              {`${formatPrice(amount)} received`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment not found</DialogTitle>
            <DialogDescription>
              The customer sees this on their order&rsquo;s page and can send the transaction ID
              again. The order keeps its bottles for a while longer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reject-reason">What was wrong (the customer sees it)</Label>
            <Input
              id="reject-reason"
              maxLength={200}
              placeholder="No payment with that transaction ID"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(false)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={pending || reason.trim().length < 3}
              onClick={() =>
                start(async () => {
                  const r = await rejectManualPaymentAction({ paymentId, reason });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("The customer has been asked again");
                  setRejecting(false);
                  router.refresh();
                })
              }
            >
              Not found
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const HAND_OPTIONS = [
  ["bkash", "bKash"],
  ["nagad", "Nagad"],
  ["bank", "Bank transfer"],
  ["cash", "Cash"],
  ["gateway", "Gateway (paid, but not recorded)"],
] as const;

/**
 * Record a payment made another way: a gateway outage, a phone order, a bank transfer. The order
 * then moves on exactly as if the gateway had confirmed it.
 */
export function RecordPayment({
  orderId,
  number,
  total,
}: {
  orderId: number;
  number: string;
  total: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<(typeof HAND_OPTIONS)[number][0]>("bkash");
  const [reference, setReference] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HandCoinsIcon /> Record payment
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`Record a payment for ${number}`}</DialogTitle>
            <DialogDescription>
              {`For money received another way. Recording ${formatPrice(total)} marks the order paid, confirms it if it was waiting, and emails the receipt.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="hand-method">Paid by</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger id="hand-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HAND_OPTIONS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hand-ref">Reference</Label>
              <Input
                id="hand-ref"
                maxLength={60}
                placeholder="Transaction ID, bank reference or receipt number"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || reference.trim().length < 3}
              onClick={() =>
                start(async () => {
                  const r = await recordPaymentAction({
                    id: orderId,
                    method,
                    reference,
                    amount: total,
                  });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Payment recorded");
                  setOpen(false);
                  setReference("");
                  router.refresh();
                })
              }
            >
              {`Record ${formatPrice(total)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
