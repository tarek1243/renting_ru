"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, t } from "../lib/api";
import { ui } from "../lib/i18n";
import { ListingCard, type ListingSummary } from "./ListingCard";

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
      .then(({ data, meta }) => {
        if (cancelled) return;
        setItems(data);
        setTotal(meta?.pagination?.total ?? data.length);
      })
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [schema.slug, buildQuery]);

  const setFilter = (key: string, value: FilterState[string]) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="card h-fit space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{T("filters")}</h2>
          <button
            className="text-xs text-brand-600 hover:underline"
            onClick={() => {
              setFilters({});
              setPrice({});
              setLocation("");
              setPage(1);
            }}
          >
            {T("clear")}
          </button>
        </div>

        <div>
          <label className="label">{T("location")}</label>
          <select className="input" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }}>
            <option value="">—</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{t(l.name, locale)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">{T("priceRange")}</label>
          <div className="flex gap-2">
            <input className="input" type="number" placeholder={T("min")} value={price.min ?? ""}
              onChange={(e) => { setPrice((p) => ({ ...p, min: e.target.value })); setPage(1); }} />
            <input className="input" type="number" placeholder={T("max")} value={price.max ?? ""}
              onChange={(e) => { setPrice((p) => ({ ...p, max: e.target.value })); setPage(1); }} />
          </div>
        </div>

        {filterableAttrs.map((attr) => (
          <div key={attr.key}>
            <label className="label">
              {t(attr.label, locale)} {attr.unit ? `(${attr.unit})` : ""}
            </label>
            {attr.filterWidget === "range" ? (
              <div className="flex gap-2">
                <input className="input" type="number" placeholder={String(attr.validation?.min ?? "")}
                  value={(filters[attr.key] as any)?.min ?? ""}
                  onChange={(e) => setFilter(attr.key, { ...(filters[attr.key] as any), min: e.target.value })} />
                <input className="input" type="number" placeholder={String(attr.validation?.max ?? "")}
                  value={(filters[attr.key] as any)?.max ?? ""}
                  onChange={(e) => setFilter(attr.key, { ...(filters[attr.key] as any), max: e.target.value })} />
              </div>
            ) : attr.filterWidget === "toggle" ? (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={filters[attr.key] === "true"}
                  onChange={(e) => setFilter(attr.key, e.target.checked ? "true" : "")} />
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

      <section>
        {loading ? (
          <p className="py-20 text-center text-gray-400">{T("loading")}</p>
        ) : items.length === 0 ? (
          <p className="py-20 text-center text-gray-400">{T("noResults")}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} locale={locale} cardAttributes={cardAttrs} />
              ))}
            </div>
            {total > 12 && (
              <div className="mt-6 flex justify-center gap-2">
                <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
                <span className="px-3 py-2 text-sm text-gray-500">{page} / {Math.ceil(total / 12)}</span>
                <button className="btn-secondary" disabled={page >= Math.ceil(total / 12)} onClick={() => setPage((p) => p + 1)}>→</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
