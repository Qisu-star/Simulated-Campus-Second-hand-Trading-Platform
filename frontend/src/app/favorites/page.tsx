"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { ItemCard } from "@/components/item-card";
import type {
  FavoriteItemWithInfo,
  FavoriteItemListResponse,
  FavoriteSellerWithInfo,
  FavoriteSellerListResponse,
  Item,
} from "@/lib/types";

type TabType = "items" | "sellers";

export default function FavoritesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("items");
  const [itemFavorites, setItemFavorites] = useState<FavoriteItemWithInfo[]>([]);
  const [sellerFavorites, setSellerFavorites] = useState<FavoriteSellerWithInfo[]>([]);
  const [itemPage, setItemPage] = useState(1);
  const [sellerPage, setSellerPage] = useState(1);
  const [itemTotalPages, setItemTotalPages] = useState(1);
  const [sellerTotalPages, setSellerTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = "/auth/login";
    }
  }, []);

  const fetchItemFavorites = useCallback(async (page: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<FavoriteItemListResponse>(
        `/api/favorites/items?page=${page}&pageSize=12`,
      );
      setItemFavorites(response.data);
      setItemTotalPages(response.totalPages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载收藏商品失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSellerFavorites = useCallback(async (page: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<FavoriteSellerListResponse>(
        `/api/favorites/sellers?page=${page}&pageSize=12`,
      );
      setSellerFavorites(response.data);
      setSellerTotalPages(response.totalPages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载收藏商家失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "items") {
      void fetchItemFavorites(itemPage);
    } else {
      void fetchSellerFavorites(sellerPage);
    }
  }, [activeTab, itemPage, sellerPage, fetchItemFavorites, fetchSellerFavorites]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 sm:py-16">
      <h1 className="mb-8 text-2xl font-bold text-slate-900">我的收藏</h1>

      {/* Tabs */}
      <div className="mb-8 flex border-b border-slate-200">
        <button
          className={`px-6 py-3 text-sm font-semibold transition ${
            activeTab === "items"
              ? "border-b-2 border-slate-900 text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => {
            setActiveTab("items");
            setItemPage(1);
          }}
          type="button"
        >
          商品收藏
        </button>
        <button
          className={`px-6 py-3 text-sm font-semibold transition ${
            activeTab === "sellers"
              ? "border-b-2 border-slate-900 text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => {
            setActiveTab("sellers");
            setSellerPage(1);
          }}
          type="button"
        >
          商家收藏
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="aspect-[4/3] bg-slate-200" />
              <div className="space-y-3 p-4">
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="h-5 w-3/4 rounded bg-slate-200" />
                <div className="h-6 w-20 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Items tab */}
      {!loading && activeTab === "items" && (
        <>
          {itemFavorites.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              <p className="text-lg font-semibold text-slate-700">暂无收藏商品</p>
              <p className="mt-2 text-sm">去浏览商品页面，收藏感兴趣的商品吧</p>
              <a
                className="mt-6 inline-block rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                href="/"
              >
                浏览商品
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {itemFavorites.map((fav) => (
                  <ItemCard key={fav.id} item={fav.item} />
                ))}
              </div>

              {/* Pagination */}
              {itemTotalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-4">
                  <button
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={itemPage <= 1}
                    onClick={() => setItemPage((prev) => Math.max(1, prev - 1))}
                    type="button"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-slate-600">
                    {itemPage} / {itemTotalPages}
                  </span>
                  <button
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={itemPage >= itemTotalPages}
                    onClick={() => setItemPage((prev) => prev + 1)}
                    type="button"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Sellers tab */}
      {!loading && activeTab === "sellers" && (
        <>
          {sellerFavorites.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              <p className="text-lg font-semibold text-slate-700">暂无收藏商家</p>
              <p className="mt-2 text-sm">浏览商品时，可以收藏感兴趣的商家</p>
              <a
                className="mt-6 inline-block rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                href="/"
              >
                浏览商品
              </a>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {sellerFavorites.map((fav) => (
                  <a
                    key={fav.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md"
                    href={`/sellers/${fav.sellerId}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-600">
                        {fav.sellerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {fav.sellerName}
                        </p>
                        <p className="text-sm text-slate-500">
                          {fav.activeItemCount} 件商品在售
                        </p>
                      </div>
                    </div>
                    <svg
                      className="h-5 w-5 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 5l7 7-7 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  </a>
                ))}
              </div>

              {/* Pagination */}
              {sellerTotalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-4">
                  <button
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={sellerPage <= 1}
                    onClick={() => setSellerPage((prev) => Math.max(1, prev - 1))}
                    type="button"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-slate-600">
                    {sellerPage} / {sellerTotalPages}
                  </span>
                  <button
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={sellerPage >= sellerTotalPages}
                    onClick={() => setSellerPage((prev) => prev + 1)}
                    type="button"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}