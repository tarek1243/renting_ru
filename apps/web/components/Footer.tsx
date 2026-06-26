import Link from "next/link";
import { ui } from "../lib/i18n";
import { VersionBadge } from "./VersionBadge";

function CarIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
    </svg>
  );
}

const LINKS: Record<string, Record<string, { href: string; label: string }[]>> = {
  explore: {
    en: [
      { href: "/en", label: "Home" },
      { href: "/en/cars", label: "Browse cars" },
      { href: "/en/account/bookings", label: "My bookings" },
      { href: "/en/account", label: "My account" },
    ],
    ar: [
      { href: "/ar", label: "الرئيسية" },
      { href: "/ar/cars", label: "السيارات" },
      { href: "/ar/account/bookings", label: "حجوزاتي" },
      { href: "/ar/account", label: "حسابي" },
    ],
  },
  support: {
    en: [
      { href: "/en/faq", label: "FAQ" },
      { href: "/en/pages/terms", label: "Terms of use" },
      { href: "/en/pages/privacy", label: "Privacy policy" },
    ],
    ar: [
      { href: "/ar/faq", label: "الأسئلة الشائعة" },
      { href: "/ar/pages/terms", label: "شروط الاستخدام" },
      { href: "/ar/pages/privacy", label: "سياسة الخصوصية" },
    ],
  },
};

const SECTION_TITLES: Record<string, Record<string, string>> = {
  explore: { en: "Explore", ar: "استكشف" },
  support: { en: "Support", ar: "الدعم" },
};

export function Footer({ locale, appVersion }: { locale: string; appVersion?: string }) {
  const T = ui(locale);
  const exploreLinks = LINKS.explore[locale] ?? LINKS.explore.en;
  const supportLinks = LINKS.support[locale] ?? LINKS.support.en;

  return (
    <footer className="mt-16 border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <Link href={`/${locale}`} className="flex items-center gap-2 text-base font-extrabold text-brand-600">
              <CarIcon />
              Renting
            </Link>
            <p className="mt-3 max-w-xs text-sm text-gray-500">
              {locale === "ar"
                ? "استأجر سيارة بثقة. مع سائق أو بدونه."
                : "Rent with confidence. Cars with or without a chauffeur."}
            </p>
            {/* Trust badges */}
            <div className="mt-5 flex flex-wrap gap-2">
              {["Verified fleet", "Free cancellation", "24/7 support"].map((b) => (
                <span key={b} className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500">
                  <svg className="h-3 w-3 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              {SECTION_TITLES.explore[locale] ?? "Explore"}
            </p>
            <ul className="space-y-2.5">
              {exploreLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-600 hover:text-brand-600">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              {SECTION_TITLES.support[locale] ?? "Support"}
            </p>
            <ul className="space-y-2.5">
              {supportLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-600 hover:text-brand-600">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Renting platform. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            {appVersion ? (
              <VersionBadge className="font-mono text-xs text-gray-400" initialVersion={appVersion} locale={locale} />
            ) : null}
            <Link href={`/${locale}/pages/terms`} className="text-xs text-gray-400 hover:text-gray-600">{T("terms")}</Link>
            <Link href={`/${locale}/faq`} className="text-xs text-gray-400 hover:text-gray-600">{T("faq")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
