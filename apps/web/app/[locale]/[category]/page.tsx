import { notFound } from "next/navigation";
import { api, t } from "../../../lib/api";
import { CategoryBrowser } from "../../../components/CategoryBrowser";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { locale: string; category: string } }) {
  try {
    const { data } = await api<any>(`/categories/${params.category}`, { revalidate: 60 });
    return { title: t(data.name, params.locale), description: t(data.description, params.locale) };
  } catch {
    return {};
  }
}

export default async function CategoryPage({
  params,
}: {
  params: { locale: string; category: string };
}) {
  let schema: any;
  try {
    schema = (await api<any>(`/categories/${params.category}`, { revalidate: 60 })).data;
  } catch {
    notFound();
  }

  let locations: any[] = [];
  try {
    locations = (await api<any[]>("/locations", { revalidate: 300 })).data;
  } catch {
    /* optional */
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{t(schema.name, params.locale)}</h1>
      <p className="mb-6 text-sm text-gray-500">{t(schema.description, params.locale)}</p>
      {/* Filters below are generated 100% from the category's attribute schema —
          a new category gets a working search UI with zero frontend changes. */}
      <CategoryBrowser locale={params.locale} schema={schema} locations={locations} />
    </div>
  );
}
