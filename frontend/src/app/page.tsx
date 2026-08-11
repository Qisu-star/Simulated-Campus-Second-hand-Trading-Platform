"use client";

import { useCallback, useEffect, useState } from "react";
import { CategoryFilter } from "@/components/category-filter";
import { ItemCard } from "@/components/item-card";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";
import type { Item, ItemListResponse } from "@/lib/types";

type PageState = "loading" | "error" | "empty" | "success";

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<Category>("全部");
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const pageSize = 20;

  const fetchItems = useCallback(
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
          `/api/items?${params.toString()}`,
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
    [],
  );

  useEffect(() => {
    void fetchItems(page, selectedCategory);
  }, [page, selectedCategory, fetchItems]);

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          校园二手集市
        </h1>
        <p className="mt-2 text-slate-600">
          发现校园里的好物，买卖二手物品。
        </p>
      </header>

      <section aria-label="分类筛选" className="mb-6">
        <CategoryFilter
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
        />
      </section>

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
            <p className="mt-2 text-sm">
              请确认后端服务已启动：{errorMessage}
            </p>
          </div>
        )}

        {pageState === "empty" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-700">
            <p className="text-lg font-semibold text-slate-900">
              当前没有在售商品
            </p>
            <p className="mt-2 text-sm text-slate-600">
              该分类下暂无商品，请尝试其他分类或稍后再来。
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

      <footer className="mt-auto pt-16 text-sm text-slate-500">
        Campus Second-hand Market - Next.js · Midway.js · SQLite
      </footer>
    </main>
  );
}