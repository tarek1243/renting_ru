"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { fmtMoney, t } from "../../../../../lib/api";
import { authedApi, getUser } from "../../../../../lib/auth";
import { ui } from "../../../../../lib/i18n";

function BookingDetail() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const T = ui(locale);
  const router = useRouter();
  const search = useSearchParams();
  const [booking, setBooking] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payInfo, setPayInfo] = useState<any | null>(null);
  const [review, setReview] = useState({ rating: 5, comment: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    authedApi<any>(`/bookings/${id}`).then(({ data }) => setBooking(data)).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!getUser()) {
      router.push(`/${locale}/login`);
      return;
    }
    load();
  }, [locale, router, load]);

  const cancel = async () => {
    if (!confirm("Cancel this booking?")) return;
    setBusy(true);
    try {
      await authedApi(`/bookings/${id}/cancel`, { method: "POST", body: {} });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pay = async (gateway: string) => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await authedApi<any>(`/bookings/${id}/payments`, { method: "POST", body: { gateway } });
      setPayInfo(data.clientPayload);
      if (data.clientPayload?.redirectUrl) window.open(data.clientPayload.redirectUrl, "_blank");
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    setBusy(true);
    try {
      await authedApi(`/bookings/${id}/review`, { method: "POST", body: review });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!booking) return <p className="py-20 text-center text-gray-400">{error ?? T("loading")}</p>;

  const lines = booking.meta?.quoteLines ?? [];
  const paid = booking.payments?.some((p: any) => p.type === "charge" && p.status === "captured");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {search.get("created") && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ {booking.code} — {T("status")}: {booking.status}
        </div>
      )}

      <div className="card space-y-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{t(booking.listing.title, locale)}</h1>
            <p className="text-sm text-gray-500">{booking.code}</p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium">{booking.status}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="label">{T("pickupDate")}</span>{new Date(booking.startAt).toLocaleString(locale)}</div>
          <div><span className="label">{T("returnDate")}</span>{new Date(booking.endAt).toLocaleString(locale)}</div>
          {booking.driver && (
            <div className="col-span-2">
              <span className="label">{T("withDriver")}</span>
              {booking.driver.user.firstName} · ★ {Number(booking.driver.avgRating).toFixed(1)} · {(booking.driver.languages ?? []).join("/")}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-gray-50 p-3 text-sm">
          {lines.map((line: any, i: number) => (
            <div key={i} className="flex justify-between text-gray-600">
              <span>{line.label}</span><span>{fmtMoney(line.amount, booking.currency, locale)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold">
            <span>{T("total")}</span><span>{fmtMoney(booking.totalAmount, booking.currency, locale)}</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {payInfo?.clientSecret && (
          <p className="rounded bg-blue-50 p-2 text-xs text-blue-700">Stripe clientSecret issued — complete with Stripe.js Elements.</p>
        )}
        {payInfo?.devNote && <p className="rounded bg-amber-50 p-2 text-xs text-amber-700">{payInfo.devNote}</p>}

        <div className="flex flex-wrap gap-2">
          {["pending", "confirmed"].includes(booking.status) && !paid && booking.paymentMethod === "online" && (
            <>
              <button className="btn-primary" disabled={busy} onClick={() => pay("stripe")}>{T("payOnline")} (Stripe)</button>
              <button className="btn-secondary" disabled={busy} onClick={() => pay("regional")}>{T("payOnline")} (Regional)</button>
            </>
          )}
          {["pending", "confirmed"].includes(booking.status) && (
            <button className="btn-secondary !text-red-600" disabled={busy} onClick={cancel}>{T("cancel")}</button>
          )}
        </div>
      </div>

      {booking.status === "completed" && !booking.review && (
        <div className="card space-y-3 p-6">
          <h2 className="font-semibold">{T("reviews")}</h2>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setReview((r) => ({ ...r, rating: star }))}
                className={`text-2xl ${star <= review.rating ? "text-amber-400" : "text-gray-300"}`}>★</button>
            ))}
          </div>
          <textarea className="input" rows={3} value={review.comment} onChange={(e) => setReview((r) => ({ ...r, comment: e.target.value }))} />
          <button className="btn-primary" disabled={busy} onClick={submitReview}>{T("save")}</button>
        </div>
      )}

      {booking.invoice && (
        <div className="card p-6 text-sm">
          <h2 className="mb-2 font-semibold">{T("invoice")} {booking.invoice.number}</h2>
          <pre className="overflow-x-auto rounded bg-gray-50 p-3 text-xs">{JSON.stringify(booking.invoice.totals, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default function BookingDetailPage() {
  return (
    <Suspense>
      <BookingDetail />
    </Suspense>
  );
}
