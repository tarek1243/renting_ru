"use client";

import { useEffect, useState } from "react";
import { authedApi } from "../../lib/auth";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface DashboardData {
  windowDays: number;
  revenue: { total: number; bookings: number };
  bookingsByStatus: Record<string, number>;
  fleet: { total: number; active: number; utilizationPercent: number };
  topListings: { listing: { id: string; slug: string; title: any } | undefined; revenue: number; bookings: number }[];
  recentBookings: { id: string; code: string; status: string; totalAmount: number; currency: string; createdAt: string; listing: { title: any }; customer: { firstName: string; lastName: string } }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  ongoing: "#8b5cf6",
  completed: "#22c55e",
  cancelled: "#ef4444",
  rejected: "#6b7280",
};

function titleEn(title: any): string {
  if (!title) return "—";
  if (typeof title === "string") return title;
  return title.en ?? title.ru ?? Object.values(title)[0] ?? "—";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    authedApi<DashboardData>("/admin/dashboard/kpis")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-400">Loading…</p>;

  const statusData = Object.entries(data.bookingsByStatus).map(([status, count]) => ({ status, count }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">
            {Number(data.revenue.total).toLocaleString()}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Bookings</p>
          <p className="mt-1 text-3xl font-bold">
            {Object.values(data.bookingsByStatus).reduce((a, b) => a + b, 0)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Fleet Utilization</p>
          <p className="mt-1 text-3xl font-bold text-green-600">
            {(data.fleet.utilizationPercent ?? 0).toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-gray-400">{data.fleet.active} active / {data.fleet.total} total</p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-base font-semibold">Bookings by Status</h2>
        {statusData.length === 0 ? (
          <p className="text-sm text-gray-400">No bookings yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData}>
              <XAxis dataKey="status" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold">Top Listings</h2>
        </div>
        {data.topListings.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400">No bookings yet.</p>
        ) : (
          <table className="w-full table-auto text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-2 text-left font-medium text-gray-500">Listing</th>
                <th className="px-5 py-2 text-right font-medium text-gray-500">Bookings</th>
                <th className="px-5 py-2 text-right font-medium text-gray-500">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.topListings.map((t, i) => (
                <tr key={i}>
                  <td className="px-5 py-2">{titleEn(t.listing?.title)}</td>
                  <td className="px-5 py-2 text-right">{t.bookings}</td>
                  <td className="px-5 py-2 text-right">{Number(t.revenue).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold">Recent Bookings</h2>
        </div>
        {data.recentBookings.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400">No bookings yet.</p>
        ) : (
          <table className="w-full table-auto text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-2 text-left font-medium text-gray-500">Code</th>
                <th className="px-5 py-2 text-left font-medium text-gray-500">Customer</th>
                <th className="px-5 py-2 text-left font-medium text-gray-500">Listing</th>
                <th className="px-5 py-2 text-left font-medium text-gray-500">Status</th>
                <th className="px-5 py-2 text-right font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentBookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-5 py-2 font-mono text-xs">{b.code}</td>
                  <td className="px-5 py-2">{b.customer.firstName} {b.customer.lastName}</td>
                  <td className="px-5 py-2">{titleEn(b.listing?.title)}</td>
                  <td className="px-5 py-2">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: (STATUS_COLORS[b.status] ?? "#6b7280") + "22", color: STATUS_COLORS[b.status] ?? "#6b7280" }}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-right">{b.currency} {Number(b.totalAmount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
