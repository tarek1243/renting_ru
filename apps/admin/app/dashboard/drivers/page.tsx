"use client";

import { useEffect, useState } from "react";
import { authedApi } from "../../../lib/auth";
import { LicenseStatus } from "@renting/shared";

interface Driver {
  id: string;
  isAvailable: boolean;
  rating: number | null;
  user: { name: string; email: string };
  license: { status: LicenseStatus; licenseNumber: string } | null;
}

const LICENSE_BADGE: Record<string, string> = {
  pending: "badge-yellow",
  approved: "badge-green",
  rejected: "badge-red",
  expired: "badge-gray",
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await authedApi<any>("/admin/drivers?perPage=50");
      setDrivers(res.items ?? res ?? []);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleAvailability(id: string, current: boolean) {
    setActionId(id);
    try {
      await authedApi(`/admin/drivers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isAvailable: !current }),
      });
      setDrivers((prev) =>
        prev.map((d) => (d.id === id ? { ...d, isAvailable: !current } : d)),
      );
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Drivers</h1>
      <div className="card overflow-hidden">
        <table className="table-auto w-full">
          <thead className="bg-gray-50">
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>License</th>
              <th>Rating</th>
              <th>Available</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading…</td></tr>
            ) : drivers.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">{d.user.name}</td>
                <td className="text-xs text-gray-500">{d.user.email}</td>
                <td>
                  {d.license ? (
                    <span className={LICENSE_BADGE[d.license.status] ?? "badge-gray"}>
                      {d.license.status}
                    </span>
                  ) : (
                    <span className="badge-gray">No license</span>
                  )}
                </td>
                <td>{d.rating ? Number(d.rating).toFixed(1) : "—"}</td>
                <td>
                  <span className={d.isAvailable ? "badge-green" : "badge-gray"}>
                    {d.isAvailable ? "Yes" : "No"}
                  </span>
                </td>
                <td>
                  <button
                    disabled={actionId === d.id}
                    onClick={() => toggleAvailability(d.id, d.isAvailable)}
                    className="btn-secondary px-2 py-1 text-xs"
                  >
                    {d.isAvailable ? "Mark unavailable" : "Mark available"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
