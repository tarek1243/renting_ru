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

function CarPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
      <svg className="h-16 w-16 text-gray-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
      </svg>
    </div>
  );
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
  const rating = Number(listing.avgRating);
  const specs = cardAttributes
    .slice(0, 3)
    .map((a) => {
      const v = listing.attributes[a.key];
      return v != null ? `${v}${a.unit ? " " + a.unit : ""}` : null;
    })
    .filter(Boolean) as string[];

  return (
    <Link
      href={`/${locale}/${listing.category.slug}/${listing.slug}`}
      className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={t(listing.title, locale)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <CarPlaceholder />
        )}
        {/* Bottom gradient for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        {/* Rating badge */}
        {rating > 0 && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur-sm">
            <span className="text-xs text-amber-400">★</span>
            <span className="text-xs font-bold text-gray-900">{rating.toFixed(1)}</span>
            {(listing.reviewsCount ?? 0) > 0 && (
              <span className="text-xs text-gray-500">({listing.reviewsCount})</span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2.5 p-4">
        <h3 className="truncate text-sm font-semibold text-gray-900 group-hover:text-brand-600">
          {t(listing.title, locale)}
        </h3>

        {specs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {specs.map((spec, i) => (
              <span key={i} className="rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-500 ring-1 ring-gray-100">
                {spec}
              </span>
            ))}
          </div>
        )}

        {dayPrice && (
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-extrabold text-brand-600">
              {fmtMoney(dayPrice.basePrice, dayPrice.currency, locale)}
            </span>
            <span className="text-xs text-gray-400">{T("perDay")}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

/** Skeleton card shown while listings are loading */
export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="skeleton aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-4 w-3/4 rounded-lg" />
        <div className="flex gap-2">
          <div className="skeleton h-5 w-14 rounded-md" />
          <div className="skeleton h-5 w-14 rounded-md" />
        </div>
        <div className="skeleton h-5 w-1/2 rounded-lg" />
      </div>
    </div>
  );
}
