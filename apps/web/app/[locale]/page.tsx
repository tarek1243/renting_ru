import Link from "next/link";
import { api, t } from "../../lib/api";
import { ui } from "../../lib/i18n";
import { ListingCard, type ListingSummary } from "../../components/ListingCard";
import { NeedRequestForm } from "../../components/NeedRequestForm";

export const revalidate = 60;

interface CategorySummary {
  slug: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  icon?: string;
}

const HERO_TEXT: Record<string, { h1: string; sub: string }> = {
  en: { h1: "Rent a car in minutes", sub: "Self-drive or with a chauffeur. Instant confirmation." },
  ar: { h1: "استأجر سيارة في دقائق", sub: "بسائق أو بدونه. تأكيد فوري." },
};

const STATS = [
  { value: "500+", label: { en: "Vehicles", ar: "مركبة" } },
  { value: "4.9★", label: { en: "Avg. rating", ar: "متوسط التقييم" } },
  { value: "Free", label: { en: "Cancellation", ar: "إلغاء مجاني" } },
  { value: "24/7", label: { en: "Support", ar: "الدعم" } },
];

export default async function HomePage({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const T = ui(locale);
  const hero = HERO_TEXT[locale] ?? HERO_TEXT.en;

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
    <div className="space-y-14">
      {/* ── Hero ──────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-blue-800 px-8 py-16 text-white sm:py-20">
        {/* Background decoration */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-white/5" />

        <div className="relative">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
            {locale === "ar" ? "متاح الآن" : "Available now"}
          </p>
          <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {hero.h1}
          </h1>
          <p className="mt-4 max-w-md text-lg text-blue-100">{hero.sub}</p>

          {/* Category quick links */}
          {categories.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-3">
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/${locale}/${c.slug}`}
                  className="group flex items-center gap-2 rounded-xl bg-white/15 px-5 py-2.5 text-sm font-semibold backdrop-blur-sm transition hover:bg-white hover:text-brand-700"
                >
                  {c.icon && <span className="text-lg">{c.icon}</span>}
                  {t(c.name, locale)}
                  <svg className="h-3.5 w-3.5 opacity-60 transition group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <NeedRequestForm locale={locale} />

      {/* ── Stats strip ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.value} className="rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-brand-600">{s.value}</p>
            <p className="mt-1 text-xs font-medium text-gray-500">
              {(s.label as Record<string, string>)[locale] ?? s.label.en}
            </p>
          </div>
        ))}
      </div>

      {/* ── Featured listings ─────────────────────────── */}
      {featured.length > 0 && (
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-600">
                {locale === "ar" ? "مميز" : "Editor's pick"}
              </p>
              <h2 className="text-2xl font-bold text-gray-900">{T("featured")}</h2>
            </div>
            <Link
              href={`/${locale}/${categories[0]?.slug}`}
              className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
            >
              {T("browseAll")}
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {/* ── How it works ──────────────────────────────── */}
      <section className="rounded-3xl bg-gray-50 px-8 py-12">
        <h2 className="mb-8 text-center text-2xl font-bold">
          {locale === "ar" ? "كيف يعمل؟" : "How it works"}
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            {
              step: "1",
              en: ["Choose your car", "Browse hundreds of verified cars across categories."],
              ar: ["اختر سيارتك", "مئات السيارات الموثقة من جميع الفئات."],
            },
            {
              step: "2",
              en: ["Confirm in seconds", "Pick your dates, extras, and pay your way."],
              ar: ["أكّد في ثوانٍ", "اختر المواعيد والإضافات وطريقة الدفع."],
            },
            {
              step: "3",
              en: ["Enjoy the ride", "Pick up your car and go. We're here 24/7."],
              ar: ["استمتع بالرحلة", "استلم سيارتك وانطلق. نحن معك على مدار الساعة."],
            },
          ].map((item) => {
            const texts = (item as any)[locale] ?? item.en;
            return (
              <div key={item.step} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-extrabold text-white shadow-md">
                  {item.step}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{texts[0]}</p>
                  <p className="mt-1 text-sm text-gray-500">{texts[1]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
