import type { MetadataRoute } from "next";
import { api } from "../lib/api";
import { LOCALES } from "../lib/i18n";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of LOCALES) {
    entries.push({ url: `${SITE}/${locale}`, changeFrequency: "daily", priority: 1 });
  }
  try {
    const { data: categories } = await api<any[]>("/categories", { revalidate: 3600 });
    for (const category of categories) {
      for (const locale of LOCALES) {
        entries.push({ url: `${SITE}/${locale}/${category.slug}`, changeFrequency: "daily", priority: 0.9 });
      }
      const { data: listings } = await api<any[]>(`/categories/${category.slug}/listings?perPage=100`, { revalidate: 3600 });
      for (const listing of listings) {
        for (const locale of LOCALES) {
          entries.push({ url: `${SITE}/${locale}/${category.slug}/${listing.slug}`, changeFrequency: "weekly", priority: 0.7 });
        }
      }
    }
  } catch {
    /* API offline during build — base entries only */
  }
  return entries;
}
