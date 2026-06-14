import { PaginationMeta } from "@renting/shared";

export const PAGINATED = Symbol("paginated");

export interface PageParams {
  page: number;
  perPage: number;
  skip: number;
  take: number;
}

export function pageParams(query: { page?: unknown; perPage?: unknown }, maxPerPage = 100): PageParams {
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(maxPerPage, Math.max(1, Number(query.perPage) || 20));
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

/** Marks a list result so the envelope interceptor lifts pagination into meta. */
export function paginated<T>(items: T[], total: number, { page, perPage }: PageParams) {
  const pagination: PaginationMeta = {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
  return { [PAGINATED]: true, items, pagination };
}

/** Whitelist-based sort parser: "?sort=createdAt&order=desc" → { createdAt: "desc" }. */
export function sortParams(
  query: { sort?: unknown; order?: unknown },
  allowed: string[],
  fallback: Record<string, "asc" | "desc">,
): Record<string, "asc" | "desc"> {
  const sort = String(query.sort ?? "");
  if (!allowed.includes(sort)) return fallback;
  const order = String(query.order) === "asc" ? "asc" : "desc";
  return { [sort]: order };
}
