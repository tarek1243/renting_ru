"use client";

import { useEffect, useState } from "react";
import { authedApi } from "../../lib/auth";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface KPIs {
  totalRevenue: number;
  currency: string;
  bookingsByStatus: Record<string, number>;
  fleetUtilization: number;
  topListings: { id: string; title: string; bookingCount: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  in_progress: "#8b5cf6",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    authedApi<KPIs>("/admin/dashboard/kpis")
      .then(setKpis)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!kpis) return <p className="text-gray-400">Loading…</p>;

  const statusData = Object.entries(kpis.bookingsByStatus).map(([status, count]) => ({
    status,
    count,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">
            {kpis.currency} {Number(kpis.totalRevenue).toLocaleString()}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Bookings</p>
          <p className="mt-1 text-3xl font-bold">
            {Object.values(kpis.bookingsByStatus).reduce((a, b) => a + b, 0)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Fleet Utilization</p>
          <p className="mt-1 text-3xl font-bold text-green-600">
            {kpis.fleetUtilization.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-base font-semibold">Bookings by Status</h2>
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
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold">Top Listings</h2>
        </div>
        <table className="table-auto w-full">
          <thead className="bg-gray-50">
            <tr>
              <th>Listing</th>
              <th>Bookings</th>
            </tr>
          </thead>
          <tbody>
            {kpis.topListings.map((l) => (
              <tr key={l.id}>
                <td>{l.title}</td>
                <td>{l.bookingCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
