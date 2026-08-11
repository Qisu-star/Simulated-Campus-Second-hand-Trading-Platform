"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HISTORY_KEY = "search_history";
const MAX_HISTORY = 10;

type SearchBarProps = {
  onSearch: (keyword: string) => void;
  initialKeyword?: string;
};

function loadHistory(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is string => typeof item === "string" && item.trim() !== "",
    );
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(0, MAX_HISTORY)),
    );
  } catch {
    // localStorage may be full or unavailable
  }
}

function addToHistory(keyword: string): string[] {
  const history = loadHistory();
  const trimmed = keyword.trim();
  if (!trimmed) {
    return history;
  }

  // Remove duplicate if exists
  const filtered = history.filter((item) => item !== trimmed);
  // Add to front
  const updated = [trimmed, ...filtered];
  // Keep only max items
  const result = updated.slice(0, MAX_HISTORY);
  saveHistory(result);
  return result;
}

export function SearchBar({ onSearch, initialKeyword = "" }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(initialKeyword);
  const [history, setHistory] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Click outside detection
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim();
      if (!trimmed) {
        return;
      }
      const updatedHistory = addToHistory(trimmed);
      setHistory(updatedHistory);
      setShowDropdown(false);
      onSearch(trimmed);
    },
    [onSearch],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSearch(inputValue);
    },
    [handleSearch, inputValue],
  );

  const handleHistoryClick = useCallback(
    (keyword: string) => {
      setInputValue(keyword);
      handleSearch(keyword);
    },
    [handleSearch],
  );

  const handleFocus = useCallback(() => {
    setHistory(loadHistory());
    setShowDropdown(true);
  }, []);

  const handleClearHistory = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    saveHistory([]);
    setHistory([]);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-4 pr-10 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            onFocus={handleFocus}
            placeholder="搜索商品名称、描述或分类..."
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          {inputValue && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setInputValue("")}
              title="清除输入"
              type="button"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </button>
          )}
        </div>
        <button
          className="rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          type="submit"
        >
          搜索
        </button>
      </form>

      {showDropdown && history.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-semibold text-slate-500">
              搜索历史
            </span>
            <button
              className="text-xs text-slate-400 hover:text-slate-600"
              onClick={handleClearHistory}
              type="button"
            >
              清除历史
            </button>
          </div>
          <ul>
            {history.map((keyword) => (
              <li key={keyword}>
                <button
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  onClick={() => handleHistoryClick(keyword)}
                  type="button"
                >
                  <svg
                    className="h-4 w-4 shrink-0 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                  <span className="truncate">{keyword}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
