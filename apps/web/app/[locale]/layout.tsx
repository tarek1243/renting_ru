import type { Metadata } from "next";
import type { ReactNode } from "react";
import { api, t } from "../../lib/api";
import { RTL_LOCALES, isLocale, DEFAULT_LOCALE } from "../../lib/i18n";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import webPackage from "../../package.json";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Renting — cars & more", template: "%s · Renting" },
  description: "Rent cars with or without a driver.",
};

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ar" }];
}

async function getCategories() {
  try {
    const { data } = await api<Array<{ slug: string; name: Record<string, string>; icon: string }>>("/categories", { revalidate: 60 });
    return data;
  } catch {
    return [];
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const categories = await getCategories();
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "https://rentingapi-production.up.railway.app/api/v1"; // "http://localhost:4000/api/v1"
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? webPackage.version;
  return (
    <html lang={locale} dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `window.__API_URL__=${JSON.stringify(apiUrl)}` }} />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Header
          locale={locale}
          categories={categories.map((c) => ({ slug: c.slug, label: t(c.name, locale) }))}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <Footer locale={locale} />
        <span
          className="fixed bottom-3 end-3 z-30 rounded-full border border-gray-200/80 bg-white/85 px-2.5 py-1 font-mono text-[10px] font-medium text-gray-400 shadow-sm backdrop-blur-sm"
          title={locale === "ar" ? `إصدار التطبيق ${appVersion}` : `App version ${appVersion}`}
          aria-label={locale === "ar" ? `الإصدار ${appVersion}` : `Version ${appVersion}`}
        >
          v{appVersion}
        </span>
      </body>
    </html>
  );
}
