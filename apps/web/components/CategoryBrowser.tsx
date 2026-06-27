"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, t } from "../lib/api";
import { authedApi, getUser } from "../lib/auth";
import { ui } from "../lib/i18n";
import { ListingCard, ListingCardSkeleton, type ListingSummary } from "./ListingCard";

interface AttributeDef {
  key: string;
  label: Record<string, string>;
  dataType: "text" | "number" | "boolean" | "select" | "multiselect";
  options: Array<{ value: string; label: Record<string, string> }> | null;
  unit: string | null;
  validation: { min?: number; max?: number } | null;
  isFilterable: boolean;
  filterWidget: "checkbox" | "select" | "range" | "toggle" | null;
  showInCard: boolean;
}

interface CategorySchema {
  slug: string;
  name: Record<string, string>;
  attributes: AttributeDef[];
  pricingUnits: Array<{ unit: string; isDefault: boolean }>;
}

type FilterState = Record<string, string | { min?: string; max?: string }>;

export function CategoryBrowser({
  locale,
  schema,
  locations,
}: {
  locale: string;
  schema: CategorySchema;
  locations: Array<{ id: string; name: Record<string, string> }>;
}) {
  const T = ui(locale);
  const [filters, setFilters] = useState<FilterState>({});
  const [price, setPrice] = useState<{ min?: string; max?: string }>({});
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ListingSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const filterableAttrs = useMemo(() => schema.attributes.filter((a) => a.isFilterable), [schema]);
  const cardAttrs = useMemo(() => schema.attributes.filter((a) => a.showInCard), [schema]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("perPage", "12");
    if (location) params.set("location", location);
    if (price.min) params.set("price[min]", price.min);
    if (price.max) params.set("price[max]", price.max);
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === "string") {
        if (value !== "") params.set(`filter[${key}]`, value);
      } else {
        if (value.min) params.set(`filter[${key}][min]`, value.min);
        if (value.max) params.set(`filter[${key}][max]`, value.max);
      }
    }
    return params.toString();
  }, [filters, price, location, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<ListingSummary[]>(`/categories/${schema.slug}/listings?${buildQuery()}`)
      .then(async ({ data, meta }) => {
        if (cancelled) return;
        let nextData = data;
        if (getUser()) {
          try {
            const { data: favorites } = await authedApi<Array<{ listing: { id: string } }>>("/me/favorites?perPage=200");
            const favoriteIds = new Set((favorites ?? []).map((f) => f.listing.id));
            nextData = data.map((listing) => ({ ...listing, isFavorited: favoriteIds.has(listing.id) }));
          } catch {
            nextData = data;
          }
        }
        if (cancelled) return;
        setItems(nextData);
        setTotal(meta?.pagination?.total ?? data.length);
      })
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [schema.slug, buildQuery]);

  const setFilter = (key: string, value: FilterState[string]) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearAll = () => {
    setFilters({});
    setPrice({});
    setLocation("");
    setPage(1);
  };

  const totalPages = Math.ceil(total / 12);
  const hasActiveFilters = Object.values(filters).some((v) => v !== "") || price.min || price.max || location;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      {/* ── Filter sidebar ─────────────────────────── */}
      <aside className="h-fit space-y-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4 2A1 1 0 017 19v-8.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            <h2 className="font-semibold text-gray-900">{T("filters")}</h2>
          </div>
          {hasActiveFilters && (
            <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={clearAll}>
              {T("clear")}
            </button>
          )}
        </div>

        {/* Location */}
        {locations.length > 0 && (
          <div className="border-b border-gray-100 px-5 py-4">
            <label className="label">{T("location")}</label>
            <select className="input" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }}>
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{t(l.name, locale)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Price range */}
        <div className="border-b border-gray-100 px-5 py-4">
          <label className="label">{T("priceRange")}</label>
          <div className="flex items-center gap-2">
            <input
              className="input text-center"
              type="number"
              placeholder={T("min")}
              value={price.min ?? ""}
              onChange={(e) => { setPrice((p) => ({ ...p, min: e.target.value })); setPage(1); }}
            />
            <span className="text-gray-300">—</span>
            <input
              className="input text-center"
              type="number"
              placeholder={T("max")}
              value={price.max ?? ""}
              onChange={(e) => { setPrice((p) => ({ ...p, max: e.target.value })); setPage(1); }}
            />
          </div>
        </div>

        {/* Dynamic attribute filters */}
        {filterableAttrs.map((attr, idx) => (
          <div key={attr.key} className={`px-5 py-4 ${idx < filterableAttrs.length - 1 ? "border-b border-gray-100" : ""}`}>
            <label className="label">
              {t(attr.label, locale)}{attr.unit ? ` (${attr.unit})` : ""}
            </label>
            {attr.filterWidget === "range" ? (
              <div className="flex items-center gap-2">
                <input className="input text-center" type="number" placeholder={String(attr.validation?.min ?? "")}
                  value={(filters[attr.key] as any)?.min ?? ""}
                  onChange={(e) => setFilter(attr.key, { ...(filters[attr.key] as any), min: e.target.value })} />
                <span className="text-gray-300">—</span>
                <input className="input text-center" type="number" placeholder={String(attr.validation?.max ?? "")}
                  value={(filters[attr.key] as any)?.max ?? ""}
                  onChange={(e) => setFilter(attr.key, { ...(filters[attr.key] as any), max: e.target.value })} />
              </div>
            ) : attr.filterWidget === "toggle" ? (
              <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-700">
                <div
                  className={`relative h-5 w-9 rounded-full transition-colors ${filters[attr.key] === "true" ? "bg-brand-600" : "bg-gray-200"}`}
                  onClick={() => setFilter(attr.key, filters[attr.key] === "true" ? "" : "true")}
                >
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${filters[attr.key] === "true" ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                {t(attr.label, locale)}
              </label>
            ) : (
              <select className="input" value={(filters[attr.key] as string) ?? ""}
                onChange={(e) => setFilter(attr.key, e.target.value)}>
                <option value="">—</option>
                {(attr.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>{t(o.label, locale)}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </aside>

      {/* ── Results ───────────────────────────────────── */}
      <section>
        {/* Results count */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {loading ? (
              <span className="skeleton inline-block h-4 w-24 rounded" />
            ) : (
              <span>
                <strong className="font-semibold text-gray-900">{total}</strong>{" "}
                {locale === "ar" ? "نتيجة" : total === 1 ? "listing" : "listings"}
              </span>
            )}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <ListingCardSkeleton key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <svg className="mb-4 h-16 w-16 text-gray-200" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z" />
            </svg>
            <p className="text-lg font-semibold text-gray-400">{T("noResults")}</p>
            <button onClick={clearAll} className="mt-4 text-sm font-semibold text-brand-600 hover:underline">{T("clear")}</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} locale={locale} cardAttributes={cardAttrs} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  className="btn-secondary !px-3 !py-2 disabled:opacity-30"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ←
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | "…")[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span key={`e${i}`} className="px-2 py-2 text-sm text-gray-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`h-9 w-9 rounded-xl text-sm font-semibold transition ${p === page ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                        >
                          {p}
                        </button>
                      )
                    )}
                </div>
                <button
                  className="btn-secondary !px-3 !py-2 disabled:opacity-30"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
