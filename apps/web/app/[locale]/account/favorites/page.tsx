"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ListingCard, type ListingSummary } from "../../../../components/ListingCard";
import { authedApi, getUser } from "../../../../lib/auth";

export default function FavoritesPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const [items, setItems] = useState<Array<{ listing: ListingSummary }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getUser()) {
      router.push(`/${locale}/login?next=/${locale}/account/favorites`);
      return;
    }
    authedApi<Array<{ listing: ListingSummary }>>("/me/favorites?perPage=50")
      .then(({ data }: any) => setItems(data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [locale, router]);

  if (loading) return <p className="py-20 text-center text-gray-400">Loading...</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{locale === "ar" ? "المفضلة" : "Saved listings"}</h1>
        <Link href={`/${locale}/account`} className="text-sm font-semibold text-brand-600 hover:underline">
          {locale === "ar" ? "الحساب" : "Account"}
        </Link>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-400">
          {locale === "ar" ? "لا توجد إعلانات محفوظة بعد." : "No saved listings yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ listing }) => (
            <ListingCard key={listing.id} listing={{ ...listing, isFavorited: true }} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
