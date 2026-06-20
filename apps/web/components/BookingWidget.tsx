"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, fmtMoney, t, ApiError } from "../lib/api";
import { authedApi, getUser } from "../lib/auth";
import { ui } from "../lib/i18n";

interface Props {
  locale: string;
  listing: any;
  schema: any;
  extras: any[];
  locations: any[];
}

export function BookingWidget({ locale, listing, schema, extras, locations }: Props) {
  const T = ui(locale);
  const router = useRouter();
  const config = schema.config ?? {};
  const defaultUnit = schema.pricingUnits.find((u: any) => u.isDefault)?.unit ?? schema.pricingUnits[0]?.unit ?? "day";

  const tomorrow = useMemo(() => {
    const d = new Date(Date.now() + 26 * 3600_000);
    d.setMinutes(0, 0, 0);
    return d;
  }, []);
  const toInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [pricingUnit, setPricingUnit] = useState<string>(defaultUnit);
  const [startAt, setStartAt] = useState(toInput(tomorrow));
  const [endAt, setEndAt] = useState(toInput(new Date(tomorrow.getTime() + 2 * 86400_000)));
  const [withDriver, setWithDriver] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({});
  const [couponCode, setCouponCode] = useState("");
  const [pickupLocationId, setPickupLocationId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"online" | "on_pickup">("on_pickup");
  const [quote, setQuote] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLicense, setNeedsLicense] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<any[]>([]);

  useEffect(() => {
    api<any>(`/listings/${listing.id}/availability`)
      .then(({ data }) => setBlocked(data.blocked))
      .catch(() => undefined);
  }, [listing.id]);

  useEffect(() => {
    if (!withDriver || !startAt || !endAt) return;
    api<any[]>(`/drivers/available?start=${new Date(startAt).toISOString()}&end=${new Date(endAt).toISOString()}`)
      .then(({ data }) => setDrivers(data))
      .catch(() => setDrivers([]));
  }, [withDriver, startAt, endAt]);

  useEffect(() => {
    if (!startAt || !endAt) return;
    const handle = setTimeout(() => {
      setError(null);
      api<any>(`/listings/${listing.id}/quote`, {
        method: "POST",
        body: {
          pricingUnit,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          withDriver,
          driverId: driverId || undefined,
          extras: Object.entries(selectedExtras)
            .filter(([, on]) => on)
            .map(([extraId]) => ({ extraId, quantity: 1 })),
          couponCode: couponCode || undefined,
        },
      })
        .then(({ data }) => setQuote(data))
        .catch((e: ApiError) => {
          setQuote(null);
          setError(e.message);
        });
    }, 350);
    return () => clearTimeout(handle);
  }, [listing.id, pricingUnit, startAt, endAt, withDriver, driverId, selectedExtras, couponCode]);

  const book = async () => {
    if (!getUser()) {
      router.push(`/${locale}/login?next=/${locale}/${listing.category.slug}/${listing.slug}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: booking } = await authedApi<any>("/bookings", {
        method: "POST",
        body: {
          listingId: listing.id,
          pricingUnit,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          withDriver,
          driverId: withDriver && driverId ? driverId : undefined,
          extras: Object.entries(selectedExtras)
            .filter(([, on]) => on)
            .map(([extraId]) => ({ extraId, quantity: 1 })),
          couponCode: couponCode || undefined,
          paymentMethod,
          pickupLocationId: pickupLocationId || undefined,
        },
      });
      router.push(`/${locale}/account/bookings/${booking.id}?created=1`);
    } catch (e: any) {
      if (e?.code === "LICENSE_REQUIRED") {
        setNeedsLicense(true);
        setError(e.message ?? "A verified driver's license is required.");
      } else {
        setError(e.message ?? "Booking failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
      {/* Pricing unit tabs */}
      {schema.pricingUnits.length > 1 && (
        <div className="flex border-b border-gray-100">
          {schema.pricingUnits.map((u: any) => (
            <button
              key={u.unit}
              onClick={() => setPricingUnit(u.unit)}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                pricingUnit === u.unit
                  ? "border-b-2 border-brand-600 text-brand-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {u.unit.charAt(0).toUpperCase() + u.unit.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-0">
        {/* ── Dates ─────────────────────────────────── */}
        <div className="border-b border-gray-100 p-5">
          <p className="label">{T("pickupDate")} → {T("returnDate")}</p>
          <div className="grid grid-cols-2 divide-x divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
            <div className="p-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{T("pickupDate")}</p>
              <input
                type="datetime-local"
                className="w-full border-0 p-0 text-sm font-medium text-gray-900 outline-none focus:ring-0"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="p-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{T("returnDate")}</p>
              <input
                type="datetime-local"
                className="w-full border-0 p-0 text-sm font-medium text-gray-900 outline-none focus:ring-0"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>
          {blocked.length > 0 && (
            <p className="mt-2 text-xs text-amber-600">
              ⚠ {T("availability")}: {blocked.slice(0, 2).map((b) =>
                `${new Date(b.startAt).toLocaleDateString(locale)}–${new Date(b.endAt).toLocaleDateString(locale)}`
              ).join(", ")} unavailable
            </p>
          )}
        </div>

        {/* ── Location ───────────────────────────────── */}
        {locations.length > 0 && (
          <div className="border-b border-gray-100 p-5">
            <label className="label">{T("location")}</label>
            <select className="input" value={pickupLocationId} onChange={(e) => setPickupLocationId(e.target.value)}>
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{t(l.name, locale)}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Driver option ──────────────────────────── */}
        {config.requiresDriverOption && (
          <div className="border-b border-gray-100 p-5 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setWithDriver(false)}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                  !withDriver
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {T("selfDrive")}
              </button>
              <button
                onClick={() => setWithDriver(true)}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                  withDriver
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {T("withDriver")}
              </button>
            </div>
            {withDriver && (
              <div>
                <label className="label">{T("chooseDriver")}</label>
                <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                  <option value="">{T("anyDriver")}</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.user.firstName} · ★{Number(d.avgRating).toFixed(1)} · {d.yearsExperience} {T("years")} · {(d.languages ?? []).join("/")}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* ── Extras ─────────────────────────────────── */}
        {extras.length > 0 && (
          <div className="border-b border-gray-100 p-5">
            <label className="label">{T("extras")}</label>
            <div className="space-y-2">
              {extras.map((extra) => (
                <label
                  key={extra.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                    selectedExtras[extra.id]
                      ? "border-brand-200 bg-brand-50"
                      : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                      selectedExtras[extra.id] ? "border-brand-600 bg-brand-600" : "border-gray-300"
                    }`}
                  >
                    {selectedExtras[extra.id] && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={!!selectedExtras[extra.id]}
                    onChange={(e) => setSelectedExtras((prev) => ({ ...prev, [extra.id]: e.target.checked }))}
                  />
                  <span className="flex-1 font-medium text-gray-800">{t(extra.name, locale)}</span>
                  <span className="text-xs font-semibold text-gray-500">
                    +{fmtMoney(extra.price, "USD", locale)}{extra.priceType === "per_unit" ? `/${pricingUnit}` : ""}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Coupon ─────────────────────────────────── */}
        <div className="border-b border-gray-100 p-5">
          <label className="label">{T("coupon")}</label>
          <input
            className="input"
            placeholder="WELCOME10"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          />
        </div>

        {/* ── Price summary ──────────────────────────── */}
        {quote && (
          <div className="border-b border-gray-100 bg-gray-50 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">{T("priceSummary")}</p>
            <div className="space-y-1.5">
              {quote.lines.map((line: any, i: number) => (
                <div key={i} className="flex justify-between text-sm text-gray-600">
                  <span>{line.label}</span>
                  <span className="font-medium">{fmtMoney(line.amount, quote.currency, locale)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-base font-extrabold text-gray-900">
              <span>{T("total")}</span>
              <span>{fmtMoney(quote.totalAmount, quote.currency, locale)}</span>
            </div>
            {quote.depositAmount > 0 && (
              <p className="mt-1.5 text-xs text-gray-400">
                + {fmtMoney(quote.depositAmount, quote.currency, locale)} {T("deposit")}
              </p>
            )}
          </div>
        )}

        {/* ── Payment method ─────────────────────────── */}
        <div className="p-5 pb-4">
          <p className="label mb-3">Payment</p>
          <div className="grid grid-cols-2 gap-2">
            {(["on_pickup", "online"] as const).map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-semibold transition ${
                  paymentMethod === method
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {method === "on_pickup" ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                )}
                {method === "on_pickup" ? T("payOnPickup") : T("payOnline")}
              </button>
            ))}
          </div>
        </div>

        {/* ── Error ──────────────────────────────────── */}
        {error && (
          <div className="mx-5 mb-4 rounded-xl bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">{error}</p>
            {needsLicense && (
              <a href={`/${locale}/account`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-red-700 underline">
                Submit your driver's license →
              </a>
            )}
          </div>
        )}

        {/* ── CTA ────────────────────────────────────── */}
        <div className="p-5 pt-0">
          <button
            className="btn-primary w-full py-3 text-base"
            disabled={!quote || busy}
            onClick={book}
          >
            {busy ? T("loading") : T("confirmBooking")}
          </button>
          <p className="mt-2.5 text-center text-xs text-gray-400">
            {locale === "ar" ? "إلغاء مجاني قبل 24 ساعة" : locale === "ru" ? "Бесплатная отмена за 24 часа" : "Free cancellation up to 24 h before pickup"}
          </p>
        </div>
      </div>
    </div>
  );
}
