import type { ApiEnvelope } from "@renting/shared";

export const API_URL =
  (typeof window !== "undefined" && (window as any).__API_URL__)
    ? (window as any).__API_URL__
    : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string | null;
  revalidate?: number | false;
}

/**
 * The ONLY data channel in the frontend — every byte comes from the REST API,
 * exactly as the future mobile app will consume it.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<{ data: T; meta?: any }> {
  const { body, token, revalidate, headers, ...rest } = options;
  const url = `${API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...(typeof window === "undefined" ? { next: revalidate === false ? undefined : { revalidate: revalidate ?? 30 } } : {}),
    });
  } catch (err: any) {
    throw new ApiError(
      "NETWORK_ERROR",
      `Cannot reach API at ${url} — ${err?.message ?? "network error"}. Check NEXT_PUBLIC_API_URL and CORS_ORIGINS.`,
      0,
    );
  }
  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!envelope || !envelope.success) {
    throw new ApiError(
      envelope?.error?.code ?? "NETWORK_ERROR",
      envelope?.error?.message ?? `Request failed (${res.status})`,
      res.status,
      envelope?.error?.details,
    );
  }
  return { data: envelope.data as T, meta: envelope.meta };
}

/** Pick a translated string for the active locale with sensible fallbacks. */
export function t(i18n: Record<string, string> | null | undefined, locale: string): string {
  if (!i18n) return "";
  return i18n[locale] ?? i18n.en ?? Object.values(i18n)[0] ?? "";
}

export function fmtMoney(amount: number | string, currency: string, locale = "en"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
}
