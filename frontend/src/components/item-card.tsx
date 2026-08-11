"use client";

import type { Item } from "@/lib/types";

type ItemCardProps = {
  item: Item;
};

export function ItemCard({ item }: ItemCardProps) {
  const isSoldOut = item.quantity === 0;

  return (
    <a
      className="group block min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
      href="#"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          alt={item.title}
          className="h-full w-full object-cover transition group-hover:scale-105"
          src={item.coverImage}
        />
        {isSoldOut && (
          <span className="absolute right-2 top-2 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white">
            售罄
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="mb-1 text-xs font-medium text-slate-500">
          {item.category}
        </p>
        <h3 className="truncate text-lg font-bold text-slate-900">
          {item.title}
        </h3>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xl font-bold text-rose-600">
            ¥{item.price.toFixed(2)}
          </span>
          <span
            className={`text-sm ${
              isSoldOut ? "font-semibold text-rose-500" : "text-slate-500"
            }`}
          >
            {isSoldOut ? "已售罄" : `库存 ${item.quantity}`}
          </span>
        </div>
      </div>
    </a>
  );
}