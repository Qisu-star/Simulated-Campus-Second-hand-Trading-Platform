"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getStoredUser, isAuthenticated } from "@/lib/auth";

type PageState = "loading" | "ready" | "error";

export default function ProfilePage() {
  const router = useRouter();
  const user = getStoredUser();
  const [pageState, setPageState] = useState<PageState>("loading");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    // Validation
    if (!currentPassword) {
      setErrorMessage("请输入当前密码");
      return;
    }
    if (!newPassword) {
      setErrorMessage("请输入新密码");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage("新密码长度至少为 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("两次输入的密码不一致");
      return;
    }

    setSubmitting(true);
    try {
      await api.put("/api/auth/password", {
        currentPassword,
        newPassword,
      });
      setSuccessMessage("密码修改成功");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (reason) {
      if (reason instanceof ApiError) {
        setErrorMessage(reason.message);
      } else {
        setErrorMessage("密码修改失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  };

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
        个人中心
      </h1>

      {/* User info */}
      <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">账号信息</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">
            {user?.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{user?.username}</p>
            <p className="text-sm text-slate-500">
              {user?.role === "admin" ? "管理员" : "用户"}
            </p>
          </div>
        </div>
      </section>

      {/* Password change form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-slate-900">修改密码</h2>

        {successMessage && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {errorMessage}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-1.5 block text-sm font-semibold text-slate-700"
              htmlFor="currentPassword"
            >
              当前密码
            </label>
            <input
              id="currentPassword"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="输入当前密码"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-semibold text-slate-700"
              htmlFor="newPassword"
            >
              新密码
            </label>
            <input
              id="newPassword"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="输入新密码（至少 6 位）"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-semibold text-slate-700"
              htmlFor="confirmPassword"
            >
              确认新密码
            </label>
            <input
              id="confirmPassword"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="再次输入新密码"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            className="w-full rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "修改中..." : "修改密码"}
          </button>
        </form>
      </section>
    </main>
  );
}
