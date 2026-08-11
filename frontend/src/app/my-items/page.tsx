"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Item, ItemListResponse } from "@/lib/types";

type PageState = "loading" | "error" | "empty" | "success";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "待审核", className: "bg-amber-100 text-amber-800" },
  active: { label: "在售", className: "bg-emerald-100 text-emerald-800" },
  delisted: { label: "已下架", className: "bg-slate-100 text-slate-600" },
};

export default function MyItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const pageSize = 20;

  const fetchMyItems = useCallback(async (currentPage: number) => {
    setPageState("loading");
    try {
      const response = await api.get<ItemListResponse>(
        `/api/items/mine?page=${currentPage}&pageSize=${pageSize}`,
      );
      setItems(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
      setPageState(response.data.length === 0 ? "empty" : "success");
      setErrorMessage("");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "加载商品失败";
      setErrorMessage(message);
      setPageState("error");
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/auth/login");
      return;
    }
    void fetchMyItems(page);
  }, [page, fetchMyItems, router]);

  const handleToggleStatus = async (itemId: number, currentStatus: string) => {
    setActionLoading(itemId);
    try {
      const newStatus = currentStatus === "delisted" ? "active" : "delisted";
      await api.patch(`/api/items/${itemId}/status`, { status: newStatus });
      void fetchMyItems(page);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "操作失败";
      alert(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrevPage = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setPage((p) => Math.min(totalPages, p + 1));
  };

  const isSoldOut = (item: Item) =>
    item.quantity === 0 && item.status === "active";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 sm:py-16">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            我的商品
          </h1>
          <p className="mt-1 text-slate-600">共 {total} 件商品</p>
        </div>
        <a
          className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          href="/items/new"
        >
          发布新商品
        </a>
      </header>

      <section aria-label="商品列表" className="flex-1">
        {pageState === "loading" && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex gap-4 p-4">
                  <div className="h-24 w-24 flex-shrink-0 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-4 w-16 rounded bg-slate-200" />
                    <div className="h-5 w-3/4 rounded bg-slate-200" />
                    <div className="h-4 w-20 rounded bg-slate-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {pageState === "error" && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
            <p className="font-semibold">加载失败</p>
            <p className="mt-2 text-sm">{errorMessage}</p>
            <button
              className="mt-4 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              onClick={() => void fetchMyItems(page)}
              type="button"
            >
              重试
            </button>
          </div>
        )}

        {pageState === "empty" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-700">
            <p className="text-lg font-semibold text-slate-900">
              还没有发布商品
            </p>
            <p className="mt-2 text-sm text-slate-600">
              点击"发布新商品"按钮开始出售你的闲置物品。
            </p>
            <a
              className="mt-6 inline-block rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              href="/items/new"
            >
              发布新商品
            </a>
          </div>
        )}

        {pageState === "success" && (
          <>
            <div className="space-y-4">
              {items.map((item) => {
                const statusInfo = STATUS_LABELS[item.status] ?? {
                  label: item.status,
                  className: "bg-slate-100 text-slate-600",
                };
                const soldOut = isSoldOut(item);

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:gap-6"
                  >
                    {/* Image */}
                    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-28">
                      <img
                        alt={item.title}
                        className="h-full w-full object-cover"
                        src={item.coverImage}
                      />
                      {soldOut && (
                        <span className="absolute right-1 top-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          售罄
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                        {soldOut && (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                            已售罄
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 truncate text-base font-bold text-slate-900 sm:text-lg">
                        {item.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                        <span className="text-lg font-bold text-rose-600">
                          ¥{item.price.toFixed(2)}
                        </span>
                        <span>库存 {item.quantity}</span>
                        <span className="text-slate-300">|</span>
                        <span>{item.category}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 flex-col gap-2">
                      <a
                        className="rounded-lg border border-slate-300 px-4 py-1.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        href={`/items/${item.id}/edit`}
                      >
                        编辑
                      </a>
                      <button
                        className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={actionLoading === item.id}
                        onClick={() =>
                          void handleToggleStatus(item.id, item.status)
                        }
                        type="button"
                      >
                        {actionLoading === item.id
                          ? "处理中..."
                          : item.status === "delisted"
                            ? "重新上架"
                            : "下架"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav
                aria-label="分页导航"
                className="mt-10 flex items-center justify-center gap-4"
              >
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={handlePrevPage}
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
                  onClick={handleNextPage}
                  type="button"
                >
                  下一页
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      <footer className="mt-auto pt-16 text-sm text-slate-500">
        <a
          className="text-slate-700 underline-offset-2 hover:underline"
          href="/"
        >
          返回首页
        </a>
      </footer>
    </main>
  );
}
