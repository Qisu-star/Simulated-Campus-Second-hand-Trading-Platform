"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ItemForm, type ItemFormData } from "@/components/item-form";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export default function NewItemPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Redirect to login if not authenticated
  if (typeof window !== "undefined" && !isAuthenticated()) {
    router.push("/auth/login");
    return null;
  }

  const handleSubmit = async (data: ItemFormData) => {
    setLoading(true);
    try {
      const images = data.images
        ? data.images
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      await api.post("/api/items", {
        title: data.title,
        price: Number(data.price),
        quantity: Number(data.quantity),
        category: data.category,
        description: data.description,
        images,
      });

      router.push("/my-items");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "发布失败";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-10 sm:px-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          发布新商品
        </h1>
        <p className="mt-1 text-slate-600">填写以下信息发布你的闲置物品</p>
      </header>

      <section aria-label="发布商品表单">
        <ItemForm
          onSubmit={handleSubmit}
          submitLabel="发布商品"
          loading={loading}
        />
      </section>
    </main>
  );
}
