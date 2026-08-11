"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Item, ItemDetailResponse, ToggleFavoriteResponse } from "@/lib/types";
import type { Review, ReviewListResponse, Order, OrderListResponse } from "@/lib/types";
import { ReviewForm } from "./ReviewForm";
import { ReviewList } from "./ReviewList";

type PageState = "loading" | "error" | "notfound" | "success";

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [item, setItem] = useState<(Item & { isItemFavorited: boolean; isSellerFavorited: boolean }) | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [itemFavLoading, setItemFavLoading] = useState(false);
  const [sellerFavLoading, setSellerFavLoading] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [cartError, setCartError] = useState("");
  const [cartLoading, setCartLoading] = useState(false);

  // Review state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [eligibleOrderId, setEligibleOrderId] = useState<number | null>(null);

  // Buy-now modal
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [paymentPassword, setPaymentPassword] = useState("");
  const [buySubmitting, setBuySubmitting] = useState(false);
  const [buyError, setBuyError] = useState("");

  const router = useRouter();

  const fetchItem = useCallback(async () => {
    setPageState("loading");
    try {
      const response = await api.get<ItemDetailResponse>(
        `/api/items/${id}`,
      );
      setItem(response.data);
      setPageState("success");
      setErrorMessage("");
    } catch (reason) {
      if (reason instanceof Error) {
        if (reason.message.includes("404") || reason.message.includes("不存在")) {
          setPageState("notfound");
        } else {
          setErrorMessage(reason.message);
          setPageState("error");
        }
      } else {
        setErrorMessage("加载商品详情失败");
        setPageState("error");
      }
    }
  }, [id]);

  const fetchReviews = useCallback(async (pageNum: number) => {
    setReviewLoading(true);
    try {
      const response = await api.get<ReviewListResponse>(
        `/api/items/${id}/reviews?page=${pageNum}&pageSize=10`,
      );
      setReviews(response.data);
      setReviewTotal(response.total);
      setReviewTotalPages(response.totalPages);
    } catch {
      // ignore
    } finally {
      setReviewLoading(false);
    }
  }, [id]);

  const checkCanReview = useCallback(async () => {
    if (!isAuthenticated() || !item) {
      setCanReview(false);
      setEligibleOrderId(null);
      return;
    }

    try {
      const ordersResponse = await api.get<OrderListResponse>(
        "/api/orders?page=1&pageSize=50",
      );

      // Find a received order that contains this item and hasn't been reviewed
      for (const order of ordersResponse.data) {
        if (order.status !== "received") continue;

        const orderItem = order.items.find((i) => i.itemId === item.id);
        if (!orderItem) continue;

        // Check if already reviewed
        const alreadyReviewed = reviews.some(
          (r) => r.orderId === order.id && r.itemId === item.id,
        );
        if (alreadyReviewed) continue;

        setCanReview(true);
        setEligibleOrderId(order.id);
        return;
      }

      setCanReview(false);
      setEligibleOrderId(null);
    } catch {
      setCanReview(false);
      setEligibleOrderId(null);
    }
  }, [item, reviews]);

  useEffect(() => {
    void fetchItem();
  }, [fetchItem]);

  useEffect(() => {
    if (pageState === "success") {
      void fetchReviews(reviewPage);
    }
  }, [pageState, fetchReviews, reviewPage]);

  useEffect(() => {
    if (pageState === "success" && item) {
      void checkCanReview();
    }
  }, [pageState, item, checkCanReview]);

  const handleToggleItemFavorite = useCallback(async () => {
    if (!isAuthenticated()) {
      window.location.href = "/auth/login";
      return;
    }

    setItemFavLoading(true);
    try {
      const response = await api.post<ToggleFavoriteResponse>(
        `/api/favorites/items/${id}`,
      );
      setItem((prev) =>
        prev
          ? {
              ...prev,
              isItemFavorited: response.data.action === "favorited",
            }
          : prev,
      );
    } catch (reason) {
      // ignore
    } finally {
      setItemFavLoading(false);
    }
  }, [id]);

  const handleToggleSellerFavorite = useCallback(async () => {
    if (!isAuthenticated()) {
      window.location.href = "/auth/login";
      return;
    }

    if (!item) return;

    setSellerFavLoading(true);
    try {
      const response = await api.post<ToggleFavoriteResponse>(
        `/api/favorites/sellers/${item.sellerId}`,
      );
      setItem((prev) =>
        prev
          ? {
              ...prev,
              isSellerFavorited: response.data.action === "favorited",
            }
          : prev,
      );
    } catch (reason) {
      // ignore
    } finally {
      setSellerFavLoading(false);
    }
  }, [item]);

  const handleAddToCart = useCallback(async () => {
    if (!isAuthenticated()) {
      window.location.href = "/auth/login";
      return;
    }

    if (!item) return;

    setCartMessage("");
    setCartError("");
    setCartLoading(true);

    try {
      await api.post("/api/cart", { itemId: item.id, quantity: 1 });
      setCartMessage("已加入购物车");
      setTimeout(() => setCartMessage(""), 3000);
    } catch (reason) {
      if (reason instanceof ApiError) {
        setCartError(reason.message);
      } else {
        setCartError("加入购物车失败");
      }
      setTimeout(() => setCartError(""), 3000);
    } finally {
      setCartLoading(false);
    }
  }, [item]);

  const handleOpenBuyModal = useCallback(() => {
    if (!isAuthenticated()) {
      window.location.href = "/auth/login";
      return;
    }

    if (!item) return;

    setBuyQuantity(1);
    setPaymentPassword("");
    setBuyError("");
    setShowBuyModal(true);
  }, [item]);

  const handleBuySubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!item) return;

      setBuyError("");
      setBuySubmitting(true);

      try {
        await api.post("/api/cart/buy-now", {
          itemId: item.id,
          quantity: buyQuantity,
          paymentPassword,
        });
        setShowBuyModal(false);
        router.push("/orders");
      } catch (reason) {
        if (reason instanceof ApiError) {
          setBuyError(reason.message);
        } else {
          setBuyError("购买失败，请稍后重试");
        }
      } finally {
        setBuySubmitting(false);
      }
    },
    [item, buyQuantity, paymentPassword, router],
  );

  // Loading skeleton
  if (pageState === "loading") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 sm:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="animate-pulse">
            <div className="aspect-[4/3] rounded-2xl bg-slate-200" />
            <div className="mt-4 flex gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 w-20 rounded-lg bg-slate-200"
                />
              ))}
            </div>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-20 rounded bg-slate-200" />
            <div className="h-8 w-3/4 rounded bg-slate-200" />
            <div className="h-10 w-28 rounded bg-slate-200" />
            <div className="h-6 w-24 rounded bg-slate-200" />
            <div className="space-y-2 pt-4">
              <div className="h-4 w-full rounded bg-slate-200" />
              <div className="h-4 w-5/6 rounded bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-200" />
            </div>
            <div className="flex items-center gap-3 pt-4">
              <div className="h-6 w-6 rounded-full bg-slate-200" />
              <div className="h-5 w-24 rounded bg-slate-200" />
            </div>
            <div className="h-12 w-full rounded-xl bg-slate-200 pt-6" />
            <div className="h-12 w-full rounded-xl bg-slate-200" />
          </div>
        </div>
      </main>
    );
  }

  // Error state
  if (pageState === "error") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 sm:py-16">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <p className="font-semibold">暂时无法加载商品详情。</p>
          <p className="mt-2 text-sm">{errorMessage}</p>
          <button
            className="mt-4 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            onClick={() => void fetchItem()}
            type="button"
          >
            重试
          </button>
        </div>
      </main>
    );
  }

  // 404 state
  if (pageState === "notfound") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 sm:py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-700">
          <p className="text-lg font-semibold text-slate-900">
            商品未找到
          </p>
          <p className="mt-2 text-sm text-slate-600">
            该商品不存在或已下架，请返回首页查看其他商品。
          </p>
          <a
            className="mt-6 inline-block rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            href="/"
          >
            返回首页
          </a>
        </div>
      </main>
    );
  }

  // Success state
  if (!item) {
    return null;
  }

  const isSoldOut = item.quantity === 0;
  const allImages: string[] = item.images.length > 0
    ? item.images
    : item.coverImage
      ? [item.coverImage]
      : [];
  const displayImage = allImages[selectedImageIndex] || item.coverImage;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 sm:py-16">
      {/* Back link */}
      <a
        className="mb-8 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        href="/"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M15 19l-7-7 7-7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
        返回首页
      </a>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Image section */}
        <section aria-label="商品图片">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
            <img
              alt={item.title}
              className="h-full w-full object-cover"
              src={displayImage}
            />
            {isSoldOut && (
              <span className="absolute right-3 top-3 rounded-full bg-rose-500 px-4 py-1.5 text-sm font-bold text-white shadow-md">
                售罄
              </span>
            )}
          </div>
          {allImages.length > 1 && (
            <div className="mt-4 flex gap-3">
              {allImages.map((image, index) => (
                <button
                  key={index}
                  className={`overflow-hidden rounded-lg border-2 transition ${
                    index === selectedImageIndex
                      ? "border-slate-900"
                      : "border-transparent hover:border-slate-300"
                  }`}
                  onClick={() => setSelectedImageIndex(index)}
                  type="button"
                >
                  <img
                    alt={`${item.title} - 图片 ${index + 1}`}
                    className="h-20 w-20 object-cover"
                    src={image}
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Info section */}
        <section aria-label="商品信息" className="flex flex-col">
          <p className="mb-1 text-sm font-medium text-slate-500">
            {item.category}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            {item.title}
          </h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-rose-600">
              ¥{item.price.toFixed(2)}
            </span>
            <span
              className={`text-base ${
                isSoldOut
                  ? "font-semibold text-rose-500"
                  : "text-slate-500"
              }`}
            >
              {isSoldOut ? "已售罄" : `库存 ${item.quantity} 件`}
            </span>
          </div>

          {/* Description */}
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              商品描述
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {item.description || "暂无描述"}
            </p>
          </div>

          {/* Seller info */}
          <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
              {item.sellerName.charAt(0).toUpperCase()}
            </div>
            <a
              className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
              href={`/sellers/${item.sellerId}`}
            >
              商家：{item.sellerName}
            </a>
          </div>

          {/* Favorite buttons */}
          <div className="mt-6 flex gap-3">
            <button
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-base font-semibold transition disabled:opacity-50 ${
                item.isItemFavorited
                  ? "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              disabled={itemFavLoading}
              onClick={() => void handleToggleItemFavorite()}
              type="button"
            >
              {itemFavLoading ? (
                <svg
                  className="h-5 w-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill={item.isItemFavorited ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              )}
              {item.isItemFavorited ? "已收藏" : "收藏商品"}
            </button>
            <button
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-base font-semibold transition disabled:opacity-50 ${
                item.isSellerFavorited
                  ? "border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              disabled={sellerFavLoading}
              onClick={() => void handleToggleSellerFavorite()}
              type="button"
            >
              {sellerFavLoading ? (
                <svg
                  className="h-5 w-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill={item.isSellerFavorited ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                  <circle
                    cx="9"
                    cy="7"
                    r="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              )}
              {item.isSellerFavorited ? "已收藏商家" : "收藏商家"}
            </button>
          </div>

          {/* Action buttons */}
          <div className="mt-3 space-y-3">
            {isSoldOut ? (
              <button
                className="w-full cursor-not-allowed rounded-xl bg-slate-300 py-3 text-base font-semibold text-slate-500"
                disabled
                type="button"
              >
                库存不足
              </button>
            ) : (
              <button
                className="w-full rounded-xl bg-slate-900 py-3 text-base font-semibold text-white transition hover:bg-slate-800"
                onClick={() => void handleOpenBuyModal()}
                type="button"
              >
                立即购买
              </button>
            )}
            <button
              className="w-full rounded-xl border border-slate-300 bg-white py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
              disabled={cartLoading}
              onClick={() => void handleAddToCart()}
              type="button"
            >
              {cartLoading ? "加入中..." : "加入购物车"}
            </button>
            {cartMessage && (
              <p className="text-center text-sm font-semibold text-emerald-600">{cartMessage}</p>
            )}
            {cartError && (
              <p className="text-center text-sm font-semibold text-rose-600">{cartError}</p>
            )}
          </div>
        </section>
      </div>

      {/* Buy-now modal */}
      {showBuyModal && item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              确认购买
            </h2>
            <p className="mb-2 text-sm text-slate-500">
              {item.title} — ¥{item.price.toFixed(2)}
            </p>

            {buyError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800">
                {buyError}
              </div>
            )}

            <form onSubmit={handleBuySubmit}>
              <div className="mb-4">
                <label
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                  htmlFor="buyQuantity"
                >
                  购买数量
                </label>
                <div className="flex items-center gap-3">
                  <button
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={buyQuantity <= 1}
                    onClick={() => setBuyQuantity((q) => Math.max(1, q - 1))}
                    type="button"
                  >
                    -
                  </button>
                  <span className="min-w-[3rem] text-center text-lg font-semibold text-slate-900">
                    {buyQuantity}
                  </span>
                  <button
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={buyQuantity >= item.quantity}
                    onClick={() => setBuyQuantity((q) => Math.min(item.quantity, q + 1))}
                    type="button"
                  >
                    +
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  库存 {item.quantity} 件
                </p>
              </div>

              <div className="mb-4">
                <label
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                  htmlFor="paymentPassword"
                >
                  支付密码
                </label>
                <input
                  id="paymentPassword"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="请输入 6 位数字密码"
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  value={paymentPassword}
                  onChange={(e) => setPaymentPassword(e.target.value)}
                />
              </div>

              <div className="mb-4 text-right">
                <span className="text-sm text-slate-600">合计：</span>
                <span className="text-xl font-bold text-rose-600">
                  ¥{(item.price * buyQuantity).toFixed(2)}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setShowBuyModal(false)}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="flex-1 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={buySubmitting || paymentPassword.length === 0}
                  type="submit"
                >
                  {buySubmitting ? "支付中..." : "确认支付"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reviews section */}
      <section
        aria-label="商品评价"
        className="mt-16 border-t border-slate-100 pt-10"
      >
        <h2 className="mb-6 text-xl font-bold text-slate-900">
          商品评价
        </h2>

        {/* Review form for eligible users */}
        {canReview && eligibleOrderId && (
          <div className="mb-6">
            <ReviewForm
              itemId={item.id}
              orderId={eligibleOrderId}
              onSuccess={() => {
                setCanReview(false);
                void fetchReviews(1);
              }}
            />
          </div>
        )}

        {/* Review list */}
        {reviewLoading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-24 rounded-xl bg-slate-200"
              />
            ))}
          </div>
        ) : (
          <ReviewList
            page={reviewPage}
            reviews={reviews}
            total={reviewTotal}
            totalPages={reviewTotalPages}
            onPrevPage={() => setReviewPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setReviewPage((p) => Math.min(reviewTotalPages, p + 1))}
          />
        )}
      </section>
    </main>
  );
}