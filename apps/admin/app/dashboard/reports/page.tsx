"use client";

import { useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const REPORT_TYPES = [
  { id: "bookings", label: "Bookings Report" },
  { id: "revenue", label: "Revenue Report" },
  { id: "fleet", label: "Fleet Utilization" },
  { id: "drivers", label: "Driver Performance" },
];

export default function ReportsPage() {
  const [type, setType] = useState("bookings");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  function download() {
    const token = localStorage.getItem("admin_access_token");
    const qs = new URLSearchParams({ from, to, format: "csv" });
    const url = `${BASE}/admin/reports/${type}?${qs}`;
    // Create a temporary anchor with the token injected via fetch → blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${type}_${from}_${to}.csv`;
        a.click();
      })
      .catch((e) => alert(e.message));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="card p-6">
        <h2 className="mb-4 font-semibold">Export Report (CSV)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Report Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input mt-1"
            >
              {REPORT_TYPES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input
              type="date" value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              type="date" value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input mt-1"
            />
          </div>
        </div>
        <div className="mt-4">
          <button onClick={download} className="btn-primary">
            Download CSV
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-3 font-semibold">Available Report Types</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REPORT_TYPES.map((r) => (
            <div
              key={r.id}
              onClick={() => setType(r.id)}
              className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                type === r.id
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="font-medium">{r.label}</p>
              <p className="mt-1 text-xs text-gray-400">
                {r.id === "bookings" && "All bookings with status & amounts"}
                {r.id === "revenue" && "Daily revenue breakdown"}
                {r.id === "fleet" && "Per-listing booking days & utilization %"}
                {r.id === "drivers" && "Per-driver trips, hours & revenue"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
