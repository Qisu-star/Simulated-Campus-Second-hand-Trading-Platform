"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/types";

export type ItemFormData = {
  title: string;
  price: string;
  quantity: string;
  category: string;
  description: string;
  images: string;
};

export type ItemFormErrors = {
  title?: string;
  price?: string;
  quantity?: string;
  category?: string;
};

type ItemFormProps = {
  initialData?: ItemFormData;
  submitLabel: string;
  onSubmit: (data: ItemFormData) => Promise<void>;
  loading?: boolean;
};

export function ItemForm({
  initialData,
  submitLabel,
  onSubmit,
  loading = false,
}: ItemFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [price, setPrice] = useState(initialData?.price ?? "");
  const [quantity, setQuantity] = useState(initialData?.quantity ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? "",
  );
  const [images, setImages] = useState(initialData?.images ?? "");
  const [errors, setErrors] = useState<ItemFormErrors>({});

  const validate = (): boolean => {
    const newErrors: ItemFormErrors = {};

    if (!title.trim()) {
      newErrors.title = "商品名称不能为空";
    }

    const priceNum = Number(price);
    if (!price || !Number.isFinite(priceNum) || priceNum <= 0) {
      newErrors.price = "价格必须大于 0";
    }

    const quantityNum = Number(quantity);
    if (
      quantity === "" ||
      !Number.isFinite(quantityNum) ||
      quantityNum < 0 ||
      !Number.isInteger(quantityNum)
    ) {
      newErrors.quantity = "数量必须是非负整数";
    }

    if (!category) {
      newErrors.category = "请选择分类";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }
    await onSubmit({ title: title.trim(), price, quantity, category, description, images });
  };

  const filteredCategories = CATEGORIES.filter((c) => c !== "全部");

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Title */}
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-slate-700"
          htmlFor="title"
        >
          商品名称 <span className="text-rose-500">*</span>
        </label>
        <input
          className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-slate-900/20 ${
            errors.title
              ? "border-rose-300 focus:border-rose-400"
              : "border-slate-300 focus:border-slate-400"
          }`}
          id="title"
          placeholder="请输入商品名称"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {errors.title && (
          <p className="mt-1 text-xs text-rose-500">{errors.title}</p>
        )}
      </div>

      {/* Price & Quantity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            className="mb-1.5 block text-sm font-semibold text-slate-700"
            htmlFor="price"
          >
            价格 (¥) <span className="text-rose-500">*</span>
          </label>
          <input
            className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-slate-900/20 ${
              errors.price
                ? "border-rose-300 focus:border-rose-400"
                : "border-slate-300 focus:border-slate-400"
            }`}
            id="price"
            min="0"
            placeholder="0.00"
            step="0.01"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          {errors.price && (
            <p className="mt-1 text-xs text-rose-500">{errors.price}</p>
          )}
        </div>
        <div>
          <label
            className="mb-1.5 block text-sm font-semibold text-slate-700"
            htmlFor="quantity"
          >
            数量 <span className="text-rose-500">*</span>
          </label>
          <input
            className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-slate-900/20 ${
              errors.quantity
                ? "border-rose-300 focus:border-rose-400"
                : "border-slate-300 focus:border-slate-400"
            }`}
            id="quantity"
            min="0"
            placeholder="0"
            step="1"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {errors.quantity && (
            <p className="mt-1 text-xs text-rose-500">{errors.quantity}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-slate-700"
          htmlFor="category"
        >
          分类 <span className="text-rose-500">*</span>
        </label>
        <select
          className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-slate-900/20 ${
            errors.category
              ? "border-rose-300 focus:border-rose-400"
              : "border-slate-300 focus:border-slate-400"
          }`}
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">请选择分类</option>
          {filteredCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="mt-1 text-xs text-rose-500">{errors.category}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-slate-700"
          htmlFor="description"
        >
          商品描述
        </label>
        <textarea
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/20"
          id="description"
          placeholder="请描述商品的新旧程度、使用情况等"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Images */}
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold text-slate-700"
          htmlFor="images"
        >
          图片链接
        </label>
        <input
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/20"
          id="images"
          placeholder="输入图片 URL，多个链接用逗号分隔"
          type="text"
          value={images}
          onChange={(e) => setImages(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">
          多个图片链接请用逗号分隔，第一张将作为封面图
        </p>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-2">
        <button
          className="rounded-xl bg-slate-900 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
          type="submit"
        >
          {loading ? "提交中..." : submitLabel}
        </button>
        <a
          className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          href="/my-items"
        >
          取消
        </a>
      </div>
    </form>
  );
}