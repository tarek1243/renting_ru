"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtMoney, t } from "../../../../lib/api";
import { authedApi, getUser } from "../../../../lib/auth";

export default function HostDashboardPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getUser()) {
      router.push(`/${locale}/login?next=/${locale}/account/host`);
      return;
    }
    authedApi<any>("/me/owner/dashboard")
      .then(({ data }) => setData(data))
      .catch((e) => setError(e.message));
  }, [locale, router]);

  if (!data) return <p className="py-20 text-center text-gray-400">{error ?? "Loading..."}</p>;

  const earnings = Object.entries(data.summary.earningsByCurrency ?? {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{locale === "ar" ? "لوحة المالك" : "Host dashboard"}</h1>
        <Link href={`/${locale}/account`} className="text-sm font-semibold text-brand-600 hover:underline">
          {locale === "ar" ? "الحساب" : "Account"}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Listings</p>
          <p className="mt-1 text-2xl font-bold">{data.summary.listings}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Views</p>
          <p className="mt-1 text-2xl font-bold">{data.summary.totalViews}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Upcoming</p>
          <p className="mt-1 text-2xl font-bold">{data.summary.upcomingBookings}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Earnings</p>
          <p className="mt-1 text-lg font-bold">
            {earnings.length ? earnings.map(([currency, amount]) => fmtMoney(Number(amount), currency, locale)).join(" / ") : "0"}
          </p>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3 font-semibold">Upcoming bookings</div>
        <div className="divide-y divide-gray-100">
          {data.upcoming.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">No upcoming bookings.</p>
          ) : data.upcoming.map((booking: any) => (
            <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
              <div>
                <p className="font-semibold">{t(booking.listing.title, locale)}</p>
                <p className="text-gray-500">{booking.customer.firstName} {booking.customer.lastName} · {new Date(booking.startAt).toLocaleString(locale)}</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">{booking.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3 font-semibold">Listings</div>
        <table className="table-auto w-full">
          <thead className="bg-gray-50">
            <tr><th>Listing</th><th>Status</th><th>Views</th><th>Rating</th><th>Bookings</th></tr>
          </thead>
          <tbody>
            {data.listings.map((listing: any) => (
              <tr key={listing.id}>
                <td className="font-medium">{t(listing.title, locale)}</td>
                <td>{listing.status}</td>
                <td>{listing.viewCount}</td>
                <td>{Number(listing.avgRating).toFixed(1)} ({listing.reviewsCount})</td>
                <td>{listing._count.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
