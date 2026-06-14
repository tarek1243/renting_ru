"use client";

import { api } from "./api";

const ACCESS_KEY = "renting.access";
const REFRESH_KEY = "renting.refresh";
const USER_KEY = "renting.user";

export interface SessionUser {
  id: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName?: string;
  roles: string[];
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function storeSession(data: { accessToken: string; refreshToken: string; user: SessionUser }): void {
  localStorage.setItem(ACCESS_KEY, data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  window.dispatchEvent(new Event("renting:auth"));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("renting:auth"));
}

/** Call the API as the logged-in user; transparently refreshes an expired access token once. */
export async function authedApi<T>(path: string, options: Parameters<typeof api>[1] = {}): Promise<{ data: T; meta?: any }> {
  const attempt = (token: string | null) => api<T>(path, { ...options, token });
  try {
    return await attempt(getAccessToken());
  } catch (e: any) {
    if (e?.code !== "TOKEN_EXPIRED") throw e;
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) throw e;
    const { data } = await api<any>("/auth/refresh", { method: "POST", body: { refreshToken } });
    storeSession(data);
    return attempt(data.accessToken);
  }
}
