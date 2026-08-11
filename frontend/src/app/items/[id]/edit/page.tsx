"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ItemForm, type ItemFormData } from "@/components/item-form";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Item, ItemDetailResponse } from "@/lib/types";

type PageState = "loading" | "error" | "notfound" | "form";

export default function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect to login if not authenticated
  if (typeof window !== "undefined" && !isAuthenticated()) {
    router.push("/auth/login");
    return null;
  }

  const fetchItem = useCallback(async () => {
    setPageState("loading");
    try {
      const response = await api.get<ItemDetailResponse>(`/api/items/${id}`);
      setItem(response.data);
      setPageState("form");
      setErrorMessage("");
    } catch (reason) {
      if (reason instanceof Error) {
        if (
          reason.message.includes("404") ||
          reason.message.includes("不存在")
        ) {
          setPageState("notfound");
        } else {
          setErrorMessage(reason.message);
          setPageState("error");
        }
      } else {
        setErrorMessage("加载商品失败");
        setPageState("error");
      }
    }
  }, [id]);

  useEffect(() => {
    void fetchItem();
  }, [fetchItem]);

  const handleSubmit = async (data: ItemFormData) => {
    setSubmitting(true);
    try {
      const images = data.images
        ? data.images
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      await api.put(`/api/items/${id}`, {
        title: data.title,
        price: Number(data.price),
        quantity: Number(data.quantity),
        category: data.category,
        description: data.description,
        images,
      });

      router.push("/my-items");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "保存失败";
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-10 sm:px-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          编辑商品
        </h1>
        <p className="mt-1 text-slate-600">修改商品信息</p>
      </header>

      <section aria-label="编辑商品表单">
        {pageState === "loading" && (
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-full rounded-xl bg-slate-200" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 rounded-xl bg-slate-200" />
              <div className="h-10 rounded-xl bg-slate-200" />
            </div>
            <div className="h-10 rounded-xl bg-slate-200" />
            <div className="h-24 rounded-xl bg-slate-200" />
            <div className="h-10 rounded-xl bg-slate-200" />
          </div>
        )}

        {pageState === "error" && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
            <p className="font-semibold">加载失败</p>
            <p className="mt-2 text-sm">{errorMessage}</p>
            <button
              className="mt-4 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              onClick={() => void fetchItem()}
              type="button"
            >
              重试
            </button>
          </div>
        )}

        {pageState === "notfound" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-700">
            <p className="text-lg font-semibold text-slate-900">商品未找到</p>
            <p className="mt-2 text-sm text-slate-600">
              该商品不存在或已下架。
            </p>
            <a
              className="mt-6 inline-block rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              href="/my-items"
            >
              返回我的商品
            </a>
          </div>
        )}

        {pageState === "form" && item && (
          <ItemForm
            initialData={{
              title: item.title,
              price: String(item.price),
              quantity: String(item.quantity),
              category: item.category,
              description: item.description,
              images: item.images.join(", "),
            }}
            onSubmit={handleSubmit}
            submitLabel="保存修改"
            loading={submitting}
          />
        )}
      </section>
    </main>
  );
}
