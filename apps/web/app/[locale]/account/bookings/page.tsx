"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtMoney, t } from "../../../../lib/api";
import { authedApi, getUser } from "../../../../lib/auth";
import { ui } from "../../../../lib/i18n";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  ongoing: "bg-indigo-50 text-indigo-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  rejected: "bg-red-50 text-red-700",
};

export default function MyBookingsPage() {
  const { locale } = useParams<{ locale: string }>();
  const T = ui(locale);
  const router = useRouter();
  const [bookings, setBookings] = useState<any[] | null>(null);

  useEffect(() => {
    if (!getUser()) {
      router.push(`/${locale}/login?next=/${locale}/account/bookings`);
      return;
    }
    authedApi<any[]>("/me/bookings?perPage=50").then(({ data }) => setBookings(data)).catch(() => setBookings([]));
  }, [locale, router]);

  if (!bookings) return <p className="py-20 text-center text-gray-400">{T("loading")}</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-bold">{T("myBookings")}</h1>
      <div className="space-y-3">
        {bookings.map((b) => (
          <Link key={b.id} href={`/${locale}/account/bookings/${b.id}`} className="card flex items-center gap-4 p-4 transition hover:shadow-md">
            {b.listing.media?.[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.listing.media[0].url} alt="" className="h-16 w-24 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t(b.listing.title, locale)}</p>
              <p className="text-xs text-gray-500">
                {b.code} · {new Date(b.startAt).toLocaleDateString(locale)} → {new Date(b.endAt).toLocaleDateString(locale)}
              </p>
            </div>
            <div className="text-end">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status] ?? ""}`}>{b.status}</span>
              <p className="mt-1 text-sm font-bold">{fmtMoney(b.totalAmount, b.currency, locale)}</p>
            </div>
          </Link>
        ))}
        {bookings.length === 0 && <p className="py-10 text-center text-gray-400">{T("noResults")}</p>}
      </div>
    </div>
  );
}
