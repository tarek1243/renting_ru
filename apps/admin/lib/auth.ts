"use client";

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string; role: string };
}

export function storeSession(s: AdminSession) {
  localStorage.setItem("admin_access_token", s.accessToken);
  localStorage.setItem("admin_refresh_token", s.refreshToken);
  localStorage.setItem("admin_user", JSON.stringify(s.user));
  window.dispatchEvent(new Event("admin:auth"));
}

export function clearSession() {
  localStorage.removeItem("admin_access_token");
  localStorage.removeItem("admin_refresh_token");
  localStorage.removeItem("admin_user");
  window.dispatchEvent(new Event("admin:auth"));
}

export function getSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("admin_access_token");
  const user = localStorage.getItem("admin_user");
  if (!token || !user) return null;
  return {
    accessToken: token,
    refreshToken: localStorage.getItem("admin_refresh_token") ?? "",
    user: JSON.parse(user),
  };
}

export async function authedApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const BASE =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const token = localStorage.getItem("admin_access_token");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  const body = await res.json();
  if (!body.success) throw new Error(body.error?.message ?? "API error");
  return body.data as T;
}
