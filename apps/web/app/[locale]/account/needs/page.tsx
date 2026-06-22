"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authedApi, getUser } from "../../../../lib/auth";

export default function MyNeedsPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const [needs, setNeeds] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ar = locale === "ar";

  useEffect(() => {
    if (!getUser()) {
      router.push(`/${locale}/login?next=/${locale}/account/needs`);
      return;
    }
    authedApi<any[]>("/needs").then(({ data }) => setNeeds(data)).catch((e) => setError(e.message));
  }, [locale, router]);

  const cancel = async (id: string) => {
    try {
      const { data } = await authedApi<any>(`/needs/${id}/cancel`, { method: "PATCH" });
      setNeeds((current) => current?.map((need) => need.id === id ? data : need) ?? []);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{ar ? "احتياجاتي" : "My transportation needs"}</h1>
          <p className="mt-1 text-sm text-gray-500">{ar ? "تابع الطلبات التي أرسلتها." : "Track requests you have submitted."}</p>
        </div>
        <Link href={`/${locale}#register-need`} className="btn-primary">{ar ? "طلب جديد" : "New need"}</Link>
      </div>
      {needs === null && !error && <p className="py-16 text-center text-gray-400">{ar ? "جارٍ التحميل…" : "Loading…"}</p>}
      {needs?.length === 0 && <div className="card p-10 text-center text-gray-500">{ar ? "لم تسجل أي احتياج بعد." : "You have not registered any needs yet."}</div>}
      {needs?.map((need) => (
        <article key={need.id} className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-brand-600">{need.code}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">{need.description}</p>
              <p className="mt-3 text-xs text-gray-400">{new Date(need.createdAt).toLocaleDateString(locale)}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">{need.status}</span>
          </div>
          {["open", "reviewing"].includes(need.status) && (
            <button className="mt-4 text-xs font-semibold text-red-600 hover:underline" onClick={() => cancel(need.id)}>
              {ar ? "إلغاء الطلب" : "Cancel request"}
            </button>
          )}
        </article>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
