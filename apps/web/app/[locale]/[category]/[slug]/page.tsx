import { notFound } from "next/navigation";
import { api, t } from "../../../../lib/api";
import { ui } from "../../../../lib/i18n";
import { BookingWidget } from "../../../../components/BookingWidget";
import { Gallery } from "../../../../components/Gallery";

export const revalidate = 60;

async function getListing(slug: string) {
  try {
    return (await api<any>(`/listings/${slug}`, { revalidate: 60 })).data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { locale: string; slug: string } }) {
  const listing = await getListing(params.slug);
  if (!listing) return {};
  return {
    title: t(listing.title, params.locale),
    description: t(listing.description, params.locale)?.slice(0, 160),
  };
}

export default async function ListingPage({
  params,
}: {
  params: { locale: string; category: string; slug: string };
}) {
  const { locale } = params;
  const T = ui(locale);
  const listing = await getListing(params.slug);
  if (!listing) notFound();

  const [schema, extras, locations, reviews] = await Promise.all([
    api<any>(`/categories/${params.category}`, { revalidate: 60 }).then((r) => r.data).catch(() => null),
    api<any[]>(`/extras?categoryId=${listing.categoryId}`, { revalidate: 60 }).then((r) => r.data).catch(() => []),
    api<any[]>("/locations", { revalidate: 300 }).then((r) => r.data).catch(() => []),
    api<any[]>(`/listings/${listing.id}/reviews?perPage=5`).then((r) => r.data).catch(() => []),
  ]);
  if (!schema) notFound();

  const dayPrice = listing.prices.find((p: any) => p.pricingUnit === "day") ?? listing.prices[0];
  const structuredData = {
    "@context": "https://schema.org",
    "@type": params.category === "cars" ? "Vehicle" : "Product",
    name: t(listing.title, locale),
    description: t(listing.description, locale),
    image: listing.media.map((m: any) => m.url),
    aggregateRating:
      listing.reviewsCount > 0
        ? { "@type": "AggregateRating", ratingValue: Number(listing.avgRating), reviewCount: listing.reviewsCount }
        : undefined,
    offers: dayPrice
      ? { "@type": "Offer", price: Number(dayPrice.basePrice), priceCurrency: dayPrice.currency, availability: "https://schema.org/InStock" }
      : undefined,
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t(listing.title, locale)}</h1>
          {Number(listing.avgRating) > 0 && (
            <p className="mt-1 text-sm text-amber-600">★ {Number(listing.avgRating).toFixed(1)} · {listing.reviewsCount} {T("reviews").toLowerCase()}</p>
          )}
        </div>
        <Gallery media={listing.media} alt={t(listing.title, locale)} />
        <p className="text-gray-600">{t(listing.description, locale)}</p>

        <section className="card p-4">
          <h2 className="mb-3 font-semibold">{T("specs")}</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {schema.attributes.map((attr: any) => {
              const value = listing.attributes[attr.key];
              if (value === undefined || value === null) return null;
              const display =
                attr.dataType === "boolean"
                  ? value ? "✓" : "—"
                  : attr.dataType === "select"
                    ? t(attr.options?.find((o: any) => o.value === value)?.label, locale) || String(value)
                    : String(value);
              return (
                <div key={attr.key}>
                  <dt className="text-xs uppercase tracking-wide text-gray-400">{t(attr.label, locale)}</dt>
                  <dd className="font-medium">{display} {attr.unit ?? ""}</dd>
                </div>
              );
            })}
          </dl>
        </section>

        {reviews.length > 0 && (
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">{T("reviews")}</h2>
            <ul className="space-y-4">
              {reviews.map((review: any) => (
                <li key={review.id} className="border-b border-gray-100 pb-3 last:border-0">
                  <p className="text-sm font-medium">{review.customer.firstName} <span className="text-amber-600">★ {review.rating}</span></p>
                  {review.comment && <p className="mt-1 text-sm text-gray-600">{review.comment}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="lg:sticky lg:top-20 lg:h-fit">
        <BookingWidget locale={locale} listing={listing} schema={schema} extras={extras} locations={locations} />
      </div>
    </div>
  );
}
