import { api, t } from "../../../lib/api";
import { ui } from "../../../lib/i18n";

export const revalidate = 300;

export default async function FaqPage({ params }: { params: { locale: string } }) {
  const T = ui(params.locale);
  let faqs: any[] = [];
  try {
    faqs = (await api<any[]>("/faqs", { revalidate: 300 })).data;
  } catch {
    /* empty */
  }
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">{T("faq")}</h1>
      <div className="space-y-3">
        {faqs.map((faq) => (
          <details key={faq.id} className="card p-4">
            <summary className="cursor-pointer font-medium">{t(faq.question, params.locale)}</summary>
            <p className="mt-2 text-sm text-gray-600">{t(faq.answer, params.locale)}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
