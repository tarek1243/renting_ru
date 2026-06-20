"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, fmtMoney, t, ApiError } from "../lib/api";
import { authedApi, getUser } from "../lib/auth";
import { ui } from "../lib/i18n";

interface Props {
  locale: string;
  listing: any;
  schema: any; // category schema incl. config + pricingUnits
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

  // availability preview
  useEffect(() => {
    api<any>(`/listings/${listing.id}/availability`)
      .then(({ data }) => setBlocked(data.blocked))
      .catch(() => undefined);
  }, [listing.id]);

  // chauffeur list when the driver option is on
  useEffect(() => {
    if (!withDriver || !startAt || !endAt) return;
    api<any[]>(`/drivers/available?start=${new Date(startAt).toISOString()}&end=${new Date(endAt).toISOString()}`)
      .then(({ data }) => setDrivers(data))
      .catch(() => setDrivers([]));
  }, [withDriver, startAt, endAt]);

  // live quote
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
    <div className="card space-y-4 p-5">
      <div className="flex gap-2">
        {schema.pricingUnits.map((u: any) => (
          <button
            key={u.unit}
            onClick={() => setPricingUnit(u.unit)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${pricingUnit === u.unit ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {u.unit}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{T("pickupDate")}</label>
          <input type="datetime-local" className="input" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </div>
        <div>
          <label className="label">{T("returnDate")}</label>
          <input type="datetime-local" className="input" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </div>
      </div>

      {blocked.length > 0 && (
        <p className="text-xs text-gray-400">
          {T("availability")}: {blocked.slice(0, 3).map((b) => `${new Date(b.startAt).toLocaleDateString(locale)}–${new Date(b.endAt).toLocaleDateString(locale)}`).join(", ")} ✕
        </p>
      )}

      {locations.length > 0 && (
        <div>
          <label className="label">{T("location")}</label>
          <select className="input" value={pickupLocationId} onChange={(e) => setPickupLocationId(e.target.value)}>
            <option value="">—</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{t(l.name, locale)}</option>
            ))}
          </select>
        </div>
      )}

      {config.requiresDriverOption && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button onClick={() => setWithDriver(false)} className={`flex-1 rounded-lg border px-3 py-2 text-sm ${!withDriver ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-gray-200 text-gray-600"}`}>
              {T("selfDrive")}
            </button>
            <button onClick={() => setWithDriver(true)} className={`flex-1 rounded-lg border px-3 py-2 text-sm ${withDriver ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-gray-200 text-gray-600"}`}>
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

      {extras.length > 0 && (
        <div>
          <label className="label">{T("extras")}</label>
          <div className="space-y-1">
            {extras.map((extra) => (
              <label key={extra.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!selectedExtras[extra.id]}
                  onChange={(e) => setSelectedExtras((prev) => ({ ...prev, [extra.id]: e.target.checked }))}
                />
                {t(extra.name, locale)}
                <span className="ms-auto text-gray-400">{fmtMoney(extra.price, "USD", locale)}{extra.priceType === "per_unit" ? ` /${pricingUnit}` : ""}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label">{T("coupon")}</label>
        <input className="input" placeholder="WELCOME10" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} />
      </div>

      {quote && (
        <div className="rounded-lg bg-gray-50 p-3 text-sm">
          <p className="mb-2 font-semibold">{T("priceSummary")}</p>
          {quote.lines.map((line: any, i: number) => (
            <div key={i} className="flex justify-between text-gray-600">
              <span>{line.label}</span>
              <span>{fmtMoney(line.amount, quote.currency, locale)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold">
            <span>{T("total")}</span>
            <span>{fmtMoney(quote.totalAmount, quote.currency, locale)}</span>
          </div>
          {quote.depositAmount > 0 && (
            <p className="mt-1 text-xs text-gray-400">+ {fmtMoney(quote.depositAmount, quote.currency, locale)} {T("deposit")}</p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <p>{error}</p>
          {needsLicense && (
            <a href={`/${locale}/account`} className="mt-2 inline-block font-medium underline">
              Submit your driver's license →
            </a>
          )}
        </div>
      )}

      <div className="flex gap-2 text-sm">
        <label className="flex flex-1 items-center gap-2">
          <input type="radio" checked={paymentMethod === "online"} onChange={() => setPaymentMethod("online")} />
          {T("payOnline")}
        </label>
        <label className="flex flex-1 items-center gap-2">
          <input type="radio" checked={paymentMethod === "on_pickup"} onChange={() => setPaymentMethod("on_pickup")} />
          {T("payOnPickup")}
        </label>
      </div>

      <button className="btn-primary w-full" disabled={!quote || busy} onClick={book}>
        {busy ? T("loading") : T("confirmBooking")}
      </button>
    </div>
  );
}
