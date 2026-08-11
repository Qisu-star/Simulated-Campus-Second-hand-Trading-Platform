"use client";

import type { Review } from "@/lib/types";

type ReviewListProps = {
  reviews: Review[];
  total: number;
  page: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 10 }).map((_, index) => (
        <span
          key={index}
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            index < rating ? "bg-amber-400" : "bg-slate-200"
          }`}
        />
      ))}
      <span className="ml-1 text-sm font-bold text-amber-600">{rating}/10</span>
    </span>
  );
}

export function ReviewList({
  reviews,
  total,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
}: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        <p className="text-sm">暂无评价</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">共 {total} 条评价</p>

      <div className="space-y-3">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                  {review.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {review.username}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {formatDate(review.createdAt)}
              </span>
            </div>

            <div className="mt-2">
              <StarRating rating={review.rating} />
            </div>

            {review.comment ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {review.comment}
              </p>
            ) : (
              <p className="mt-2 text-sm italic text-slate-400">
                用户未留下文字评价
              </p>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="评价分页"
          className="flex items-center justify-center gap-4"
        >
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page <= 1}
            onClick={onPrevPage}
            type="button"
          >
            上一页
          </button>
          <span className="text-sm text-slate-600">
            第 {page} / {totalPages} 页
          </span>
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={onNextPage}
            type="button"
          >
            下一页
          </button>
        </nav>
      )}
    </div>
  );
}