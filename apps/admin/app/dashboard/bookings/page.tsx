"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedApi } from "../../../lib/auth";
import { BookingStatus, BOOKING_TRANSITIONS } from "@renting/shared";

interface Booking {
  id: string;
  code: string;
  status: BookingStatus;
  totalAmount: number;
  currency: string;
  startAt: string;
  endAt: string;
  customer: { name: string; email: string } | null;
  listing: { title: object } | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-yellow",
  confirmed: "badge-blue",
  in_progress: "badge-blue",
  completed: "badge-green",
  cancelled: "badge-red",
  disputed: "badge-red",
  no_show: "badge-gray",
  refunded: "badge-gray",
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), perPage: "20" });
      if (status) qs.set("status", status);
      const res = await authedApi<{ items: Booking[]; total: number }>(
        `/admin/bookings?${qs}`,
      );
      setBookings((res as any).items ?? []);
      setTotal((res as any).total ?? 0);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function transition(id: string, toStatus: string) {
    setTransitioning(id);
    try {
      await authedApi(`/admin/bookings/${id}/transition`, {
        method: "PATCH",
        body: JSON.stringify({ status: toStatus }),
      });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setTransitioning(null);
    }
  }

  const pages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="input w-48"
        >
          <option value="">All statuses</option>
          {Object.values(BookingStatus).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="table-auto w-full">
          <thead className="bg-gray-50">
            <tr>
              <th>Code</th>
              <th>Customer</th>
              <th>Listing</th>
              <th>Dates</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">Loading…</td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">No bookings</td></tr>
            ) : bookings.map((b) => {
              const nextStatuses = (BOOKING_TRANSITIONS as any)[b.status] ?? [];
              return (
                <tr key={b.id}>
                  <td className="font-mono text-xs">{b.code}</td>
                  <td>{b.customer?.name ?? "—"}</td>
                  <td className="max-w-[140px] truncate">
                    {typeof b.listing?.title === "object"
                      ? (b.listing.title as any).en
                      : b.listing?.title ?? "—"}
                  </td>
                  <td className="text-xs">
                    {new Date(b.startAt).toLocaleDateString()}<br />
                    {new Date(b.endAt).toLocaleDateString()}
                  </td>
                  <td>{b.currency} {Number(b.totalAmount).toLocaleString()}</td>
                  <td>
                    <span className={STATUS_BADGE[b.status] ?? "badge-gray"}>{b.status}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {nextStatuses.map((ns: string) => (
                        <button
                          key={ns}
                          disabled={transitioning === b.id}
                          onClick={() => transition(b.id, ns)}
                          className="btn-secondary px-2 py-1 text-xs"
                        >
                          → {ns}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={p === page ? "btn-primary px-3 py-1" : "btn-secondary px-3 py-1"}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
