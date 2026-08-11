"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Order, OrderListResponse } from "@/lib/types";

type PageState = "loading" | "ready" | "error" | "empty";

function OrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "sell" ? "sell" : "buy";

  const [activeTab, setActiveTab] = useState<"buy" | "sell">(initialTab);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [receiveLoading, setReceiveLoading] = useState<number | null>(null);

  const pageSize = 10;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth/login");
    }
  }, [router]);

  const fetchOrders = useCallback(async () => {
    setPageState("loading");
    try {
      const endpoint =
        activeTab === "buy"
          ? `/api/orders?page=${page}&pageSize=${pageSize}`
          : `/api/orders/sales?page=${page}&pageSize=${pageSize}`;

      const response = await api.get<OrderListResponse>(endpoint);

      if (response.data.length === 0) {
        setPageState("empty");
      } else {
        setOrders(response.data);
        setTotal(response.total);
        setTotalPages(response.totalPages);
        setPageState("ready");
      }
    } catch (reason) {
      if (reason instanceof ApiError) {
        setErrorMessage(reason.message);
      } else {
        setErrorMessage("加载订单失败");
      }
      setPageState("error");
    }
  }, [activeTab, page]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleTabChange = useCallback((tab: "buy" | "sell") => {
    setActiveTab(tab);
    setPage(1);
    setPageState("loading");
  }, []);

  const handleConfirmReceive = useCallback(async (orderId: number) => {
    setReceiveLoading(orderId);
    try {
      await api.post(`/api/orders/${orderId}/receive`);
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, status: "received" as const }
            : order,
        ),
      );
    } catch (reason) {
      if (reason instanceof ApiError) {
        setErrorMessage(reason.message);
      } else {
        setErrorMessage("操作失败");
      }
    } finally {
      setReceiveLoading(null);
    }
  }, []);

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending_receipt":
        return "未签收";
      case "received":
        return "已签收";
      default:
        return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "pending_receipt":
        return "bg-amber-100 text-amber-800";
      case "received":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

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
          我的订单
        </h1>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <p className="font-semibold">加载订单失败</p>
          <p className="mt-2 text-sm">{errorMessage}</p>
          <button
            className="mt-4 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            onClick={() => void fetchOrders()}
            type="button"
          >
            重试
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10 sm:py-16">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        我的订单
      </h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1">
        <button
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "buy"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
          onClick={() => handleTabChange("buy")}
          type="button"
        >
          购买
        </button>
        <button
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "sell"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
          onClick={() => handleTabChange("sell")}
          type="button"
        >
          售出
        </button>
      </div>

      {/* Empty state */}
      {pageState === "empty" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <p className="text-lg font-semibold text-slate-900">
            {activeTab === "buy" ? "暂无购买订单" : "暂无售出订单"}
          </p>
          <p className="mt-2 text-sm">
            {activeTab === "buy"
              ? "去逛逛，发现心仪的商品吧"
              : "商品被购买后，订单会显示在这里"}
          </p>
          {activeTab === "buy" && (
            <Link
              className="mt-6 inline-block rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
              href="/"
            >
              去逛逛
            </Link>
          )}
        </div>
      )}

      {/* Orders list */}
      {pageState === "ready" && (
        <>
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                {/* Order header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      订单 #{order.id}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(order.status)}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(order.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>

                {/* Order items */}
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        <img
                          alt={item.title}
                          className="h-full w-full object-cover"
                          src={item.coverImage || "/placeholder.svg"}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          ¥{item.price.toFixed(2)} x {item.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order footer */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm text-slate-500">
                    共 {order.items.reduce((s, i) => s + i.quantity, 0)} 件
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-rose-600">
                      ¥{order.totalPrice.toFixed(2)}
                    </span>
                    {activeTab === "buy" &&
                      order.status === "pending_receipt" && (
                        <button
                          className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={receiveLoading === order.id}
                          onClick={() => void handleConfirmReceive(order.id)}
                          type="button"
                        >
                          {receiveLoading === order.id
                            ? "处理中..."
                            : "确认签收"}
                        </button>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                上一页
              </button>
              <span className="px-3 text-sm text-slate-600">
                {page} / {totalPages}
              </span>
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                type="button"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700" />
        </main>
      }
    >
      <OrdersPageContent />
    </Suspense>
  );
}
