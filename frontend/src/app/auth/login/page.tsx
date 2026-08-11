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

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post<AuthResponse>("/api/auth/login", {
        username,
        password,
      });

      setToken(response.token);
      setStoredUser(response.data);
      router.push("/");
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "登录失败，请重试";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">登录</h1>
        <p className="mb-8 text-sm text-slate-600">欢迎回来，请登录你的账号</p>

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
              placeholder="输入用户名"
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
              placeholder="输入密码"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
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
            {isLoading ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          还没有账号？{" "}
          <a
            className="font-semibold text-blue-700 hover:text-blue-800"
            href="/auth/register"
          >
            立即注册
          </a>
        </p>
      </div>
    </main>
  );
}
