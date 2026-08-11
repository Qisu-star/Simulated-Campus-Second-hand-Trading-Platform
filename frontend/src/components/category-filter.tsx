"use client";

import { CATEGORIES, type Category } from "@/lib/types";

type CategoryFilterProps = {
  selectedCategory: Category;
  onCategoryChange: (category: Category) => void;
};

export function CategoryFilter({
  selectedCategory,
  onCategoryChange,
}: CategoryFilterProps) {
  return (
    <nav
      aria-label="商品分类筛选"
      className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"
    >
      {CATEGORIES.map((category) => {
        const isSelected = category === selectedCategory;
        return (
          <button
            key={category}
            className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              isSelected
                ? "bg-blue-700 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => onCategoryChange(category)}
            type="button"
          >
            {category}
          </button>
        );
      })}
    </nav>
  );
}
