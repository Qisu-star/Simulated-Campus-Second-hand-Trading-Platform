"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearAuth, getStoredUser, isAuthenticated } from "@/lib/auth";

export function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const user = getStoredUser();
  const loggedIn = isAuthenticated();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close mobile menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = searchValue.trim();
      if (!trimmed) {
        return;
      }
      window.location.href = `/?q=${encodeURIComponent(trimmed)}`;
    },
    [searchValue],
  );

  const handleLogout = useCallback(() => {
    clearAuth();
    setDropdownOpen(false);
    window.location.href = "/";
  }, []);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        {/* Left: Site name */}
        <a
          className="shrink-0 text-xl font-bold tracking-tight text-slate-950 transition hover:text-blue-700"
          href="/"
        >
          校园二手集市
        </a>

        {/* Center: Search (hidden on mobile) */}
        <form
          className="hidden flex-1 sm:flex sm:max-w-md"
          onSubmit={handleSearchSubmit}
        >
          <div className="relative flex w-full">
            <input
              className="w-full rounded-l-xl border border-slate-300 bg-slate-50 py-2 pl-4 pr-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="搜索商品..."
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <button
              className="rounded-r-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              type="submit"
            >
              搜索
            </button>
          </div>
        </form>

        {/* Right: Icons and user */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Favorites */}
          <a
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-rose-500"
            href="/favorites"
            title="收藏"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </a>

          {/* Cart */}
          <a
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-blue-600"
            href="/cart"
            title="购物车"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </a>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            {loggedIn && user ? (
              <button
                className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={() => setDropdownOpen((prev) => !prev)}
                type="button"
              >
                <svg
                  className="h-5 w-5 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
                <span className="hidden sm:inline">{user.username}</span>
                <svg
                  className={`h-4 w-4 text-slate-400 transition ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M19 9l-7 7-7-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </button>
            ) : (
              <a
                className="flex h-10 items-center gap-1.5 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
                href="/auth/login"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
                <span>登录</span>
              </a>
            )}

            {dropdownOpen && loggedIn && user && (
              <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {user.username}
                  </p>
                  <p className="text-xs text-slate-500">
                    {user.role === "admin" ? "管理员" : "用户"}
                  </p>
                </div>
                <div className="py-1">
                  <a
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <svg
                      className="h-4 w-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                    个人中心
                  </a>
                  <a
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    href="/my-items"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <svg
                      className="h-4 w-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                    我的商品
                  </a>
                  <a
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    href="/orders"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <svg
                      className="h-4 w-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                    我的订单
                  </a>
                  <a
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    href="/account"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <svg
                      className="h-4 w-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                    账户
                  </a>
                  {user.role === "admin" && (
                    <a
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                      href="#"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <svg
                        className="h-4 w-4 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      审核管理
                    </a>
                  )}
                </div>
                <div className="border-t border-slate-100 py-1">
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                    onClick={handleLogout}
                    type="button"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                    退出登录
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 sm:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            type="button"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              ) : (
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile search bar */}
      {mobileMenuOpen && (
        <div
          className="border-t border-slate-200 bg-white px-4 pb-4 pt-3 sm:hidden"
          ref={mobileMenuRef}
        >
          <form onSubmit={handleSearchSubmit}>
            <div className="relative flex w-full">
              <input
                className="w-full rounded-l-xl border border-slate-300 bg-slate-50 py-2.5 pl-4 pr-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="搜索商品..."
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
              <button
                className="rounded-r-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                type="submit"
              >
                搜索
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}