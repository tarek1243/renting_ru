import type { ApiEnvelope } from "@renting/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { revalidate?: number } = {},
): Promise<ApiEnvelope<T>> {
  const { revalidate, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    next: revalidate !== undefined ? ({ revalidate } as any) : undefined,
  });
  const body: ApiEnvelope<T> = await res.json();
  if (!body.success) throw new ApiError(body.error!.code, body.error!.message);
  return body;
}

export async function authedApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("admin_access_token")
      : null;
  return api<T>(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
