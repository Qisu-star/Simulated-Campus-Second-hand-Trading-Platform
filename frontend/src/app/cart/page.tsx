"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { CartItem } from "@/lib/types";

type PageState = "loading" | "ready" | "error" | "empty";

export default function CartPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentPassword, setPaymentPassword] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth/login");
    } else {
      setPageState("ready");
    }
  }, [router]);

  const fetchCart = useCallback(async () => {
    try {
      const response = await api.get<{ data: CartItem[] }>("/api/cart");
      const items = response.data;
      if (items.length === 0) {
        setPageState("empty");
      } else {
        setCartItems(items);
        setPageState("ready");
      }
    } catch {
      setErrorMessage("加载购物车失败");
      setPageState("error");
    }
  }, []);

  useEffect(() => {
    if (pageState === "ready" || pageState === "empty") {
      void fetchCart();
    }
  }, [pageState, fetchCart]);

  // When pageState becomes "ready" from loading, we haven't fetched yet
  // We need to trigger fetch when pageState transitions to "ready"
  useEffect(() => {
    if (pageState === "ready" && cartItems.length === 0) {
      void fetchCart();
    }
  }, [pageState, cartItems.length, fetchCart]);

  const handleToggleSelect = useCallback(async (item: CartItem) => {
    const newSelected = !item.selected;
    // Optimistic update
    setCartItems((prev) =>
      prev.map((ci) =>
        ci.id === item.id ? { ...ci, selected: newSelected } : ci,
      ),
    );

    try {
      await api.patch(`/api/cart/${item.id}/select`, { selected: newSelected });
    } catch {
      // Revert
      setCartItems((prev) =>
        prev.map((ci) =>
          ci.id === item.id ? { ...ci, selected: !newSelected } : ci,
        ),
      );
    }
  }, []);

  const handleDelete = useCallback(async (item: CartItem) => {
    setLoadingItemId(item.id);
    try {
      await api.del(`/api/cart/${item.id}`);
      setCartItems((prev) => {
        const updated = prev.filter((ci) => ci.id !== item.id);
        if (updated.length === 0) {
          setPageState("empty");
        }
        return updated;
      });
    } catch (reason) {
      if (reason instanceof ApiError) {
        setErrorMessage(reason.message);
      } else {
        setErrorMessage("删除失败");
      }
    } finally {
      setLoadingItemId(null);
    }
  }, []);

  const selectedItems = cartItems.filter((item) => item.selected);
  const totalPrice = selectedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const handleOpenPayment = useCallback(() => {
    if (selectedItems.length === 0) {
      return;
    }
    setPaymentPassword("");
    setPaymentError("");
    setShowPaymentModal(true);
  }, [selectedItems.length]);

  const handlePaymentSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPaymentError("");
      setPaymentSubmitting(true);

      try {
        await api.post("/api/cart/checkout", { paymentPassword });
        setShowPaymentModal(false);
        router.push("/orders");
      } catch (reason) {
        if (reason instanceof ApiError) {
          setPaymentError(reason.message);
        } else {
          setPaymentError("支付失败，请稍后重试");
        }
      } finally {
        setPaymentSubmitting(false);
      }
    },
    [paymentPassword, router],
  );

  // Loading state
  if (pageState === "loading") {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700" />
      </main>
    );
  }

  // Error state
  if (pageState === "error") {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10 sm:py-16">
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          购物车
        </h1>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <p className="font-semibold">加载购物车失败</p>
          <p className="mt-2 text-sm">{errorMessage}</p>
          <button
            className="mt-4 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            onClick={() => {
              setPageState("ready");
            }}
            type="button"
          >
            重试
          </button>
        </div>
      </main>
    );
  }

  // Empty state
  if (pageState === "empty") {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10 sm:py-16">
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          购物车
        </h1>
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <svg
            className="mx-auto mb-4 h-16 w-16 text-slate-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
            />
          </svg>
          <p className="text-lg font-semibold text-slate-900">购物车是空的</p>
          <p className="mt-2 text-sm">快去逛逛，发现心仪的商品吧</p>
          <a
            className="mt-6 inline-block rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
            href="/"
          >
            去逛逛
          </a>
        </div>
      </main>
    );
  }

  // Ready state
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10 sm:py-16">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        购物车
      </h1>

      {/* Cart items list */}
      <div className="flex-1 space-y-4">
        {cartItems.map((item) => {
          const subtotal = item.price * item.quantity;
          const isSoldOut = item.stock === 0 || item.status !== "active";

          return (
            <div
              key={item.id}
              className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition ${
                isSoldOut ? "border-slate-200 opacity-60" : "border-slate-200"
              }`}
            >
              {/* Checkbox */}
              <button
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${
                  item.selected
                    ? "border-blue-700 bg-blue-700 text-white"
                    : "border-slate-300 bg-white text-transparent"
                }`}
                disabled={isSoldOut}
                onClick={() => void handleToggleSelect(item)}
                type="button"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                  />
                </svg>
              </button>

              {/* Image */}
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                <img
                  alt={item.title}
                  className="h-full w-full object-cover"
                  src={item.coverImage || "/placeholder.svg"}
                />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {item.title}
                </p>
                <p className="mt-1 text-base font-bold text-rose-600">
                  ¥{item.price.toFixed(2)}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span>x{item.quantity}</span>
                  {isSoldOut && (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-600">
                      已下架
                    </span>
                  )}
                </div>
              </div>

              {/* Subtotal */}
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-900">
                  ¥{subtotal.toFixed(2)}
                </p>
              </div>

              {/* Delete button */}
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                disabled={loadingItemId === item.id}
                onClick={() => void handleDelete(item)}
                type="button"
              >
                {loadingItemId === item.id ? (
                  <svg
                    className="h-4 w-4 animate-spin"
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
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom bar */}
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-slate-600">
            已选 {selectedItems.length} 件
          </span>
          <span className="text-2xl font-bold text-rose-600">
            ¥{totalPrice.toFixed(2)}
          </span>
        </div>
        <button
          className="rounded-xl bg-blue-700 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={selectedItems.length === 0}
          onClick={handleOpenPayment}
          type="button"
        >
          结算
        </button>
      </div>

      {/* Payment modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              确认支付
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              支付金额：
              <span className="font-bold text-rose-600">
                ¥{totalPrice.toFixed(2)}
              </span>
            </p>

            {paymentError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800">
                {paymentError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit}>
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

              <div className="mt-5 flex gap-3">
                <button
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setShowPaymentModal(false)}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="flex-1 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={paymentSubmitting || paymentPassword.length === 0}
                  type="submit"
                >
                  {paymentSubmitting ? "支付中..." : "确认支付"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
