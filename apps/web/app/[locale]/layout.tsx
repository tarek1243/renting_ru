import type { Metadata } from "next";
import type { ReactNode } from "react";
import { api, t } from "../../lib/api";
import { RTL_LOCALES, isLocale, DEFAULT_LOCALE } from "../../lib/i18n";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Renting — cars & more", template: "%s · Renting" },
  description: "Rent cars with or without a driver.",
};

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ru" }, { locale: "ar" }];
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
  return (
    <html lang={locale} dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"}>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Header
          locale={locale}
          categories={categories.map((c) => ({ slug: c.slug, label: t(c.name, locale) }))}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
