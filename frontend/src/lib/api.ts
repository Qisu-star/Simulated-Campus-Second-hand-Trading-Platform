import { getToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  headers["Accept"] = "application/json";

  const fetchOptions: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, fetchOptions);

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      responseBody?.message ?? `请求失败 (${response.status})`,
      response.status,
    );
  }

  return responseBody as T;
}

export const api = {
  get: <T = unknown>(path: string) => apiRequest<T>(path),

  post: <T = unknown>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "POST", body }),

  put: <T = unknown>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "PUT", body }),
};