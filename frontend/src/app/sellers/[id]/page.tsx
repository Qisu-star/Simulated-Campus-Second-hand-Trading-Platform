"use client";

import { use, useCallback, useEffect, useState } from "react";
import { CategoryFilter } from "@/components/category-filter";
import { ItemCard } from "@/components/item-card";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";
import type { Item, ItemListResponse } from "@/lib/types";

type PageState = "loading" | "error" | "notfound" | "success" | "empty";

type SellerInfo = {
  id: number;
  username: string;
  createdAt: string;
};

type SellerResponse = {
  data: SellerInfo;
};

export default function SellerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<Category>("全部");
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const pageSize = 20;

  const fetchSeller = useCallback(async () => {
    try {
      const response = await api.get<SellerResponse>(`/api/sellers/${id}`);
      setSeller(response.data);
    } catch {
      setPageState("notfound");
      return null;
    }
    return true;
  }, [id]);

  const fetchSellerItems = useCallback(
    async (currentPage: number, category: Category) => {
      setPageState("loading");
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(pageSize),
        });
        if (category !== "全部") {
          params.set("category", category);
        }

        const response = await api.get<ItemListResponse>(
          `/api/sellers/${id}/items?${params.toString()}`,
        );

        setItems(response.data);
        setTotal(response.total);
        setTotalPages(response.totalPages);
        setPageState(response.data.length === 0 ? "empty" : "success");
        setErrorMessage("");
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : "加载商品失败";
        setErrorMessage(message);
        setPageState("error");
      }
    },
    [id],
  );

  const loadData = useCallback(async () => {
    const sellerOk = await fetchSeller();
    if (sellerOk) {
      await fetchSellerItems(page, selectedCategory);
    }
  }, [fetchSeller, fetchSellerItems, page, selectedCategory]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Only re-fetch items when page or category changes after initial load
  useEffect(() => {
    if (seller) {
      void fetchSellerItems(page, selectedCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedCategory]);

  const handleCategoryChange = (category: Category) => {
    setSelectedCategory(category);
    setPage(1);
  };

  const handlePrevPage = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setPage((p) => Math.min(totalPages, p + 1));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Loading state
  if (pageState === "loading" && !seller) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 sm:py-16">
        <div className="animate-pulse">
          <div className="mb-8 h-8 w-48 rounded bg-slate-200" />
          <div className="mb-8 space-y-2">
            <div className="h-5 w-32 rounded bg-slate-200" />
            <div className="h-4 w-56 rounded bg-slate-200" />
          </div>
          <div className="mb-6 h-10 w-full rounded-full bg-slate-200" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="aspect-[4/3] bg-slate-200" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-16 rounded bg-slate-200" />
                  <div className="h-5 w-3/4 rounded bg-slate-200" />
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-16 rounded bg-slate-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
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
            商家未找到
          </p>
          <p className="mt-2 text-sm text-slate-600">
            该商家不存在，请返回首页查看其他商品。
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

  // Error state
  if (pageState === "error" && !seller) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 sm:py-16">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <p className="font-semibold">暂时无法加载商家信息。</p>
          <p className="mt-2 text-sm">{errorMessage}</p>
          <button
            className="mt-4 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            onClick={() => void loadData()}
            type="button"
          >
            重试
          </button>
        </div>
      </main>
    );
  }

  if (!seller) {
    return null;
  }

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

      {/* Seller info header */}
      <section aria-label="商家信息" className="mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-2xl font-bold text-slate-600">
            {seller.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {seller.username}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              注册时间：{formatDate(seller.createdAt)}
            </p>
          </div>
        </div>
      </section>

      {/* Category filter */}
      <section aria-label="分类筛选" className="mb-6">
        <CategoryFilter
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
        />
      </section>

      {/* Items list */}
      <section aria-label="商品列表" className="flex-1">
        {pageState === "loading" && (
          <div
            aria-label="正在加载商品"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="aspect-[4/3] bg-slate-200" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-16 rounded bg-slate-200" />
                  <div className="h-5 w-3/4 rounded bg-slate-200" />
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-16 rounded bg-slate-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {pageState === "error" && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
            <p className="font-semibold">暂时无法加载商品。</p>
            <p className="mt-2 text-sm">{errorMessage}</p>
            <button
              className="mt-4 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              onClick={() => void fetchSellerItems(page, selectedCategory)}
              type="button"
            >
              重试
            </button>
          </div>
        )}

        {pageState === "empty" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-700">
            <p className="text-lg font-semibold text-slate-900">
              该商家暂无在售商品
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {selectedCategory !== "全部"
                ? "该分类下暂无商品，请尝试其他分类。"
                : "请稍后再来查看。"}
            </p>
          </div>
        )}

        {pageState === "success" && (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <ItemCard item={item} key={item.id} />
              ))}
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

      {/* Reviews placeholder section */}
      <section
        aria-label="近期评价"
        className="mt-16 border-t border-slate-100 pt-10"
      >
        <h2 className="mb-6 text-xl font-bold text-slate-900">
          近期评价
        </h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          <p className="text-sm">暂无评价</p>
        </div>
      </section>
    </main>
  );
}