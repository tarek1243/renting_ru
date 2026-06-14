import Link from "next/link";
import { fmtMoney, t } from "../lib/api";
import { ui } from "../lib/i18n";

export interface ListingSummary {
  id: string;
  slug: string;
  title: Record<string, string>;
  avgRating: string | number;
  reviewsCount?: number;
  attributes: Record<string, unknown>;
  category: { slug: string };
  media: Array<{ url: string; isCover?: boolean }>;
  prices: Array<{ pricingUnit: string; currency: string; basePrice: string | number }>;
}

export function ListingCard({
  listing,
  locale,
  cardAttributes = [],
}: {
  listing: ListingSummary;
  locale: string;
  cardAttributes?: Array<{ key: string; label: Record<string, string>; unit?: string | null }>;
}) {
  const T = ui(locale);
  const cover = listing.media.find((m) => m.isCover) ?? listing.media[0];
  const dayPrice = listing.prices.find((p) => p.pricingUnit === "day") ?? listing.prices[0];
  return (
    <Link
      href={`/${locale}/${listing.category.slug}/${listing.slug}`}
      className="card group overflow-hidden transition hover:shadow-md"
    >
      <div className="aspect-[3/2] w-full overflow-hidden bg-gray-100">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={t(listing.title, locale)}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{t(listing.title, locale)}</h3>
          {Number(listing.avgRating) > 0 && (
            <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              ★ {Number(listing.avgRating).toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          {cardAttributes.slice(0, 4).map((attr) => {
            const value = listing.attributes[attr.key];
            if (value === undefined || value === null) return null;
            return (
              <span key={attr.key}>
                {String(value)} {attr.unit ?? ""}
              </span>
            );
          })}
        </div>
        {dayPrice && (
          <p className="text-sm">
            <span className="text-lg font-bold text-brand-600">
              {fmtMoney(dayPrice.basePrice, dayPrice.currency, locale)}
            </span>
            <span className="text-gray-500">{T("perDay")}</span>
          </p>
        )}
      </div>
    </Link>
  );
}
