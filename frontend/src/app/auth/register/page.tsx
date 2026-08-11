"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { setToken, setStoredUser } from "@/lib/auth";

type AuthResponse = {
  data: {
    id: number;
    username: string;
    role: string;
    createdAt: string;
  };
  token: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post<AuthResponse>("/api/auth/register", {
        username,
        password,
      });

      setToken(response.token);
      setStoredUser(response.data);
      router.push("/");
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "注册失败，请重试";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">注册</h1>
        <p className="mb-8 text-sm text-slate-600">
          创建账号，开始使用二手交易平台
        </p>

        <form className="grid gap-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="username"
            >
              用户名
            </label>
            <input
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              id="username"
              placeholder="中英文和数字，至少1位"
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
              }}
              required
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="password"
            >
              密码
            </label>
            <input
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              id="password"
              placeholder="至少6位"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              required
              minLength={6}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="confirmPassword"
            >
              确认密码
            </label>
            <input
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              id="confirmPassword"
              placeholder="再次输入密码"
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
              }}
              required
              disabled={isLoading}
            />
          </div>

          <button
            className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "注册中…" : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          已有账号？{" "}
          <a
            className="font-semibold text-blue-700 hover:text-blue-800"
            href="/auth/login"
          >
            立即登录
          </a>
        </p>
      </div>
    </main>
  );
}
