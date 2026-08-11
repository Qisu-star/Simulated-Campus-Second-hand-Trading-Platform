"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { AccountInfo } from "@/lib/types";

type PageState = "loading" | "ready" | "error";

export default function AccountPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);

  // Balance
  const [balanceInput, setBalanceInput] = useState("");
  const [balanceSubmitting, setBalanceSubmitting] = useState(false);

  // Payment password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Messages
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth/login");
    } else {
      setPageState("ready");
    }
  }, [router]);

  const fetchAccount = useCallback(async () => {
    try {
      const response = await api.get<{ data: AccountInfo }>("/api/account");
      setAccountInfo(response.data);
    } catch {
      setErrorMessage("加载账户信息失败");
    }
  }, []);

  useEffect(() => {
    if (pageState === "ready") {
      void fetchAccount();
    }
  }, [pageState, fetchAccount]);

  const handleSetBalance = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSuccessMessage("");
      setErrorMessage("");

      const balance = Number(balanceInput);
      if (!Number.isFinite(balance)) {
        setErrorMessage("请输入有效的数字");
        return;
      }

      setBalanceSubmitting(true);
      try {
        await api.put("/api/account/balance", { balance });
        setSuccessMessage("余额更新成功");
        setAccountInfo((prev) => (prev ? { ...prev, balance } : prev));
      } catch (reason) {
        if (reason instanceof ApiError) {
          setErrorMessage(reason.message);
        } else {
          setErrorMessage("余额更新失败，请稍后重试");
        }
      } finally {
        setBalanceSubmitting(false);
      }
    },
    [balanceInput],
  );

  const handleSetPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSuccessMessage("");
      setErrorMessage("");

      // Validation
      if (!/^\d{6}$/.test(password)) {
        setErrorMessage("支付密码必须为 6 位数字");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("两次输入的密码不一致");
        return;
      }

      setPasswordSubmitting(true);
      try {
        await api.put("/api/account/password", { password });
        setSuccessMessage("支付密码设置成功");
        setPassword("");
        setConfirmPassword("");
        setAccountInfo((prev) => (prev ? { ...prev, hasPaymentPassword: true } : prev));
      } catch (reason) {
        if (reason instanceof ApiError) {
          setErrorMessage(reason.message);
        } else {
          setErrorMessage("支付密码设置失败，请稍后重试");
        }
      } finally {
        setPasswordSubmitting(false);
      }
    },
    [password, confirmPassword],
  );

  if (pageState === "loading") {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        虚拟账户
      </h1>

      {/* Messages */}
      {successMessage && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* Balance section */}
      <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-slate-900">账户余额</h2>

        <div className="mb-6 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-slate-900">
            {accountInfo?.balance.toFixed(2) ?? "—"}
          </span>
          <span className="text-lg text-slate-500">元</span>
        </div>

        <form className="flex items-end gap-4" onSubmit={handleSetBalance}>
          <div className="flex-1">
            <label
              className="mb-1.5 block text-sm font-semibold text-slate-700"
              htmlFor="balance"
            >
              设置余额（演示用途）
            </label>
            <input
              id="balance"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="输入金额"
              type="number"
              step="0.01"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
            />
          </div>
          <button
            className="rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={balanceSubmitting}
            type="submit"
          >
            {balanceSubmitting ? "设置中..." : "设置"}
          </button>
        </form>
      </section>

      {/* Payment password section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">支付密码</h2>
        <p className="mb-6 text-sm text-slate-500">
          {accountInfo?.hasPaymentPassword
            ? "已设置支付密码"
            : "尚未设置支付密码"}
        </p>

        <form className="space-y-5" onSubmit={handleSetPassword}>
          <div>
            <label
              className="mb-1.5 block text-sm font-semibold text-slate-700"
              htmlFor="password"
            >
              支付密码
            </label>
            <input
              id="password"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="6 位数字"
              type="password"
              maxLength={6}
              inputMode="numeric"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-semibold text-slate-700"
              htmlFor="confirmPassword"
            >
              确认支付密码
            </label>
            <input
              id="confirmPassword"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="再次输入 6 位数字"
              type="password"
              maxLength={6}
              inputMode="numeric"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            className="w-full rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={passwordSubmitting}
            type="submit"
          >
            {passwordSubmitting ? "设置中..." : "设置支付密码"}
          </button>
        </form>
      </section>
    </main>
  );
}