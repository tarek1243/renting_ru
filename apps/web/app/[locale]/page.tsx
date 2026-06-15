import Link from "next/link";
import { api, t } from "../../lib/api";
import { ui } from "../../lib/i18n";
import { ListingCard, type ListingSummary } from "../../components/ListingCard";

export const revalidate = 60;

interface CategorySummary {
  slug: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  icon?: string;
}

export default async function HomePage({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const T = ui(locale);

  let categories: CategorySummary[] = [];
  let featured: ListingSummary[] = [];
  try {
    categories = (await api<CategorySummary[]>("/categories", { revalidate: 60 })).data;
    if (categories[0]) {
      featured = (
        await api<ListingSummary[]>(`/categories/${categories[0].slug}/listings?featured=true&perPage=6`, { revalidate: 60 })
      ).data;
    }
  } catch {
    /* API offline — render the shell */
  }

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-brand-600 px-8 py-14 text-white">
        <h1 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl">
          {locale === "ru" ? "Аренда без лишних шагов" : locale === "ar" ? "استئجار بدون تعقيد" : "Renting without the friction"}
        </h1>
        <p className="mt-3 max-w-lg text-brand-100">
          {locale === "ru"
            ? "Авто с водителем и без."
            : locale === "ar"
              ? "سيارات مع سائق أو بدونه."
              : "Cars with or without a chauffeur."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {categories.map((c) => (
            <Link key={c.slug} href={`/${locale}/${c.slug}`} className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              {t(c.name, locale)}
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{T("featured")}</h2>
            <Link href={`/${locale}/${categories[0]?.slug}`} className="text-sm text-brand-600 hover:underline">
              {T("browseAll")} →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
