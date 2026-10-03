"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FileDownIcon,
  MailIcon,
  PackageCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Textarea } from "@/components/admin/ui/textarea";
import { STATUS_LABELS, type OrderStatus } from "@/server/orders/state";
import {
  RETURN_CONDITION_LABELS,
  RETURN_CONDITIONS,
  type ReturnCondition,
} from "@/server/shipping/returns-meta";
import { addNoteAction, moveOrdersAction, resendReceiptAction } from "../actions";
import { returnOrderAction } from "../../shipping/actions";

/** What a move asks for before it happens: destructive ones confirm, restocking ones offer it */
type Confirm = { to: OrderStatus; restock: boolean | null };

const DESTRUCTIVE: OrderStatus[] = ["cancelled", "returned", "delivery_failed"];
const PRIMARY_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm order",
  packed: "Mark packed",
  shipped: "Mark shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Mark delivered",
};

export function OrderActions({
  id,
  number,
  next,
  restockable,
  canManage,
  email,
  status,
}: {
  id: number;
  number: string;
  status: OrderStatus;
  /** Statuses this order may move to by hand */
  next: OrderStatus[];
  /** Statuses whose move can put the bottles back */
  restockable: OrderStatus[];
  canManage: boolean;
  email: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [note, setNote] = useState("");
  const [condition, setCondition] = useState<ReturnCondition>("unopened");

  const primary = next.find((s) => !DESTRUCTIVE.includes(s) && s !== "return_requested");
  const others = next.filter((s) => s !== primary);

  function move(to: OrderStatus, opts: { note?: string; restock?: boolean } = {}) {
    start(async () => {
      const r = await moveOrdersAction({ ids: [id], to, ...opts });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${number}: ${STATUS_LABELS[to].toLowerCase()}`);
      setConfirm(null);
      setNote("");
      router.refresh();
    });
  }

  // A return is recorded with why it came back and the state it came back in
  function recordReturn(restock: boolean) {
    start(async () => {
      const r = await returnOrderAction({ id, reason: note.trim(), condition, restock });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${number}: returned`);
      setConfirm(null);
      setNote("");
      router.refresh();
    });
  }

  function ask(to: OrderStatus) {
    if (DESTRUCTIVE.includes(to) || restockable.includes(to))
      setConfirm({ to, restock: restockable.includes(to) ? true : null });
    else move(to);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <a href={`/api/admin/orders/${id}/invoice`} download>
          <FileDownIcon /> Invoice
        </a>
      </Button>
      {canManage && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await resendReceiptAction({ id });
              if (!r.ok) return void toast.error(r.error);
              toast.success(`E-receipt sent to ${email}`);
              router.refresh();
            })
          }
        >
          <MailIcon /> Resend receipt
        </Button>
      )}
      {canManage && others.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              More <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {others.map((s) => (
              <DropdownMenuItem
                key={s}
                variant={DESTRUCTIVE.includes(s) ? "destructive" : "default"}
                onSelect={() => ask(s)}
              >
                {s === "cancelled" ? <XCircleIcon /> : null}
                {s === "cancelled" ? "Cancel order" : STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {canManage && primary && (
        <Button size="sm" disabled={pending} onClick={() => ask(primary)}>
          {primary === "packed" ? <PackageCheckIcon /> : <CheckIcon />}
          {status === "delivery_failed" && primary === "shipped"
            ? "Try delivery again"
            : (PRIMARY_LABEL[primary] ?? STATUS_LABELS[primary])}
        </Button>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirm.to === "cancelled"
                    ? `Cancel ${number}?`
                    : `${number}: ${STATUS_LABELS[confirm.to].toLowerCase()}?`}
                </DialogTitle>
                <DialogDescription>
                  {confirm.to === "cancelled"
                    ? "The customer isn't told by ZALFI. Call them if they don't know yet. This can't be undone."
                    : confirm.to === "returned"
                      ? "The parcel came back. This can't be undone."
                      : "The courier couldn't deliver. You can send it again or mark it returned."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                {confirm.to === "returned" && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="return-condition">How it came back</Label>
                    <Select
                      value={condition}
                      onValueChange={(v) => {
                        setCondition(v as ReturnCondition);
                        if (v === "missing") setConfirm({ ...confirm, restock: false });
                      }}
                    >
                      <SelectTrigger id="return-condition" className="w-full">
                        <SelectValue>{RETURN_CONDITION_LABELS[condition]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {RETURN_CONDITIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {RETURN_CONDITION_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {confirm.restock !== null &&
                  !(confirm.to === "returned" && condition === "missing") && (
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        checked={confirm.restock}
                        onCheckedChange={(v) => setConfirm({ ...confirm, restock: !!v })}
                        className="mt-0.5"
                      />
                      <span>
                        Put the bottles back in stock
                        <span className="text-muted-foreground block text-xs">
                          Untick if they are damaged or lost.
                        </span>
                      </span>
                    </label>
                  )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="move-note">
                    {confirm.to === "returned" ? "Why it came back" : "Reason (on the timeline)"}
                  </Label>
                  <Textarea
                    id="move-note"
                    rows={2}
                    value={note}
                    maxLength={500}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirm(null)}>
                  Keep as is
                </Button>
                <Button
                  variant={confirm.to === "cancelled" ? "destructive" : "default"}
                  disabled={pending || (confirm.to === "returned" && note.trim().length < 3)}
                  onClick={() =>
                    confirm.to === "returned"
                      ? recordReturn(!!confirm.restock && condition !== "missing")
                      : move(confirm.to, {
                          note: note.trim() || undefined,
                          restock: confirm.restock ?? undefined,
                        })
                  }
                >
                  {confirm.to === "cancelled" ? "Cancel order" : STATUS_LABELS[confirm.to]}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NoteForm({ id }: { id: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        start(async () => {
          const r = await addNoteAction({ id, text });
          if (!r.ok) return void toast.error(r.error);
          setText("");
          router.refresh();
        });
      }}
    >
      <Label htmlFor="order-note" className="sr-only">
        Add a note for the team
      </Label>
      <Textarea
        id="order-note"
        rows={2}
        placeholder="Add a note for the team (the customer never sees it)"
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline" disabled={pending || !text.trim()}>
          Add note
        </Button>
      </div>
    </form>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Couldn't copy. Select the text instead.");
        }
      }}
    >
      {done ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
