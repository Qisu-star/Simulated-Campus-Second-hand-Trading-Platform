"use client";

import { api, ApiError } from "@/lib/api";
import { useCallback, useState } from "react";

type ReviewFormProps = {
  orderId: number;
  itemId: number;
  onSuccess: () => void;
};

export function ReviewForm({ orderId, itemId, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(10);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setSubmitting(true);

      try {
        await api.post("/api/reviews", {
          orderId,
          itemId,
          rating,
          comment: comment.trim() || "",
        });
        setSuccess(true);
        onSuccess();
      } catch (reason) {
        if (reason instanceof ApiError) {
          setError(reason.message);
        } else {
          setError("提交评价失败，请稍后重试");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [orderId, itemId, rating, comment, onSuccess],
  );

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        评价已提交，感谢您的反馈！
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <h3 className="text-sm font-semibold text-slate-700">评价此商品</h3>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800">
          {error}
        </div>
      )}

      <div>
        <label
          className="mb-1 block text-sm font-medium text-slate-600"
          htmlFor="rating"
        >
          评分：{rating} / 10
        </label>
        <div className="flex items-center gap-2">
          <input
            id="rating"
            className="w-full accent-blue-600"
            max={10}
            min={1}
            type="range"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          />
          <span className="min-w-[2rem] text-center text-sm font-bold text-slate-700">
            {rating}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>1 - 很差</span>
          <span>10 - 非常好</span>
        </div>
      </div>

      <div>
        <label
          className="mb-1 block text-sm font-medium text-slate-600"
          htmlFor="comment"
        >
          评论（可选）
        </label>
        <textarea
          id="comment"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          maxLength={500}
          placeholder="分享您的使用体验..."
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <button
        className="w-full rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "提交中..." : "提交评价"}
      </button>
    </form>
  );
}