"use client";

import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Item, ItemDetailResponse } from "@/lib/types";

type PageState = "loading" | "error" | "notfound" | "success";

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [item, setItem] = useState<Item | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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

  useEffect(() => {
    void fetchItem();
  }, [fetchItem]);

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

          {/* Action buttons */}
          <div className="mt-8 space-y-3">
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
                onClick={() => {
                  alert("请先登录后购买");
                }}
                type="button"
              >
                立即购买
              </button>
            )}
            <button
              className="w-full rounded-xl border border-slate-300 bg-white py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => {
                alert("请先登录后加入购物车");
              }}
              type="button"
            >
              加入购物车
            </button>
          </div>
        </section>
      </div>

      {/* Reviews section */}
      <section
        aria-label="商品评价"
        className="mt-16 border-t border-slate-100 pt-10"
      >
        <h2 className="mb-6 text-xl font-bold text-slate-900">
          商品评价
        </h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          <p className="text-sm">暂无评价</p>
        </div>
      </section>
    </main>
  );
}