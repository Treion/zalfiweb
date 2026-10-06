"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, MessageSquareReplyIcon, StarIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Textarea } from "@/components/admin/ui/textarea";
import { formatDateTime } from "@/lib/time";
import type { AdminReview } from "@/server/reviews";
import { moderateReviewAction, replyReviewAction } from "./actions";

const STATUS = {
  pending: { label: "To read", variant: "secondary" },
  approved: { label: "On the shop", variant: "default" },
  rejected: { label: "Not shown", variant: "outline" },
} as const;

export function ReviewsView({ reviews }: { reviews: AdminReview[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {reviews.map((r) => (
        <li key={r.id}>
          <ReviewCard r={r} />
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({ r }: { r: AdminReview }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.reply ?? "");

  function moderate(status: "approved" | "rejected") {
    start(async () => {
      const res = await moderateReviewAction({ id: r.id, status });
      if (!res.ok) return void toast.error(res.error);
      toast.success(status === "approved" ? "On the shop" : "Not shown");
      router.refresh();
    });
  }
  function saveReply() {
    start(async () => {
      const res = await replyReviewAction({ id: r.id, reply });
      if (!res.ok) return void toast.error(res.error);
      toast.success(reply.trim() ? "Reply saved" : "Reply removed");
      setReplying(false);
      router.refresh();
    });
  }

  const s = STATUS[r.status];
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className="flex items-center gap-0.5"
            role="img"
            aria-label={`${r.rating} out of 5`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <StarIcon
                key={n}
                aria-hidden
                className={`size-4 ${n <= r.rating ? "fill-current" : "text-muted-foreground/40"}`}
              />
            ))}
          </span>
          <span className="font-medium">{r.fragrance ?? r.set ?? "A product"}</span>
          <Badge variant={s.variant}>{s.label}</Badge>
          <span className="text-muted-foreground ml-auto text-xs">
            {formatDateTime(r.createdAt)}
          </span>
        </div>
        {r.body ? (
          <p className="text-sm leading-relaxed whitespace-pre-line">{r.body}</p>
        ) : (
          <p className="text-muted-foreground text-sm italic">A rating, no words.</p>
        )}
        <p className="text-muted-foreground text-xs">
          Signed “{r.name}” · {r.customerName} ·{" "}
          <Link href={`/admin/orders/${r.orderId}`} className="underline-offset-4 hover:underline">
            {r.orderNumber}
          </Link>
        </p>
        {r.reply && !replying && (
          <div className="border-l-2 pl-3 text-sm">
            <p className="text-muted-foreground text-xs">Your reply</p>
            <p className="mt-1 whitespace-pre-line">{r.reply}</p>
          </div>
        )}
        {replying && (
          <div className="flex flex-col gap-2">
            <Textarea
              aria-label={`Reply to ${r.name}`}
              value={reply}
              maxLength={600}
              rows={3}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Thank them, in the house's voice. Shown under the review."
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveReply} disabled={pending}>
                Save reply
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setReply(r.reply ?? "");
                  setReplying(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {r.status !== "approved" && (
            <Button size="sm" onClick={() => moderate("approved")} disabled={pending}>
              <CheckIcon /> Approve
            </Button>
          )}
          {r.status !== "rejected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => moderate("rejected")}
              disabled={pending}
            >
              <XIcon /> {r.status === "approved" ? "Take off the shop" : "Don't show"}
            </Button>
          )}
          {!replying && (
            <Button size="sm" variant="ghost" onClick={() => setReplying(true)}>
              <MessageSquareReplyIcon /> {r.reply ? "Edit reply" : "Reply"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
