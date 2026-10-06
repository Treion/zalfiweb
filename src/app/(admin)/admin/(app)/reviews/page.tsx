import Link from "next/link";
import { MessageSquareQuoteIcon } from "lucide-react";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { requireAdmin } from "@/server/auth/session";
import {
  REVIEW_FILTERS,
  listReviewsAdmin,
  reviewCounts,
  type ReviewFilter,
} from "@/server/reviews";
import { getSettings } from "@/server/settings";
import { ReviewsView } from "./ReviewsView";

export const metadata = { title: "Reviews" };

const LABELS: Record<ReviewFilter, string> = {
  pending: "To read",
  approved: "On the shop",
  rejected: "Not shown",
  all: "All",
};

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requireAdmin("products.manage");
  const show = (await searchParams).show;
  const filter: ReviewFilter = REVIEW_FILTERS.includes(show as ReviewFilter)
    ? (show as ReviewFilter)
    : "pending";
  const [rows, counts, settings] = await Promise.all([
    listReviewsAdmin(filter),
    reviewCounts(),
    getSettings("reviews"),
  ]);
  const total = counts.pending + counts.approved + counts.rejected;
  const n: Record<ReviewFilter, number> = { ...counts, all: total };

  return (
    <>
      <PageHeader
        title="Reviews"
        description={`From buyers of delivered orders. Nothing shows on the shop until you approve it.${settings.show ? "" : " Reviews are switched off on the shop (Settings → Reviews)."}`}
      />
      <nav
        aria-label="Review views"
        className="bg-muted text-muted-foreground mb-4 inline-flex h-9 max-w-full items-center overflow-x-auto rounded-lg p-[3px] text-sm"
      >
        {REVIEW_FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "pending" ? "/admin/reviews" : `/admin/reviews?show=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={`rounded-md px-3 py-1 font-medium whitespace-nowrap ${filter === f ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"}`}
          >
            {LABELS[f]}
            <span className="ml-1.5 tabular-nums opacity-60">{n[f]}</span>
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <ReviewsView reviews={rows} />
      ) : (
        <EmptyState
          icon={MessageSquareQuoteIcon}
          title={filter === "pending" ? "Nothing to read" : "No reviews here yet"}
        >
          {settings.askAfterDelivery
            ? "Each delivered order gets one email asking for a review. New ones wait here."
            : "Buyers can review from their order page once it's delivered. New ones wait here."}
        </EmptyState>
      )}
    </>
  );
}
