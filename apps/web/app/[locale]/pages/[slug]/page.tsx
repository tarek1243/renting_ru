import { notFound } from "next/navigation";
import { api, t } from "../../../../lib/api";

export const revalidate = 300;

export default async function ContentPage({ params }: { params: { locale: string; slug: string } }) {
  let page: any;
  try {
    page = (await api<any>(`/pages/${params.slug}`, { revalidate: 300 })).data;
  } catch {
    notFound();
  }
  return (
    <article className="prose mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{t(page.title, params.locale)}</h1>
      <div className="mt-4 whitespace-pre-wrap text-gray-700">{t(page.body, params.locale)}</div>
    </article>
  );
}
