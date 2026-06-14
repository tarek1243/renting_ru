"use client";

import { useEffect, useState } from "react";
import { authedApi } from "../../../lib/auth";
import { LicenseStatus } from "@renting/shared";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isVerified: boolean;
  createdAt: string;
  license: {
    id: string;
    status: LicenseStatus;
    expiresAt: string | null;
  } | null;
}

const LICENSE_BADGE: Record<string, string> = {
  pending: "badge-yellow",
  approved: "badge-green",
  rejected: "badge-red",
  expired: "badge-gray",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await authedApi<any>(`/admin/customers?page=${page}&perPage=20`);
      setCustomers(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]); // eslint-disable-line

  async function verifyLicense(licenseId: string, approve: boolean) {
    setActionId(licenseId);
    try {
      await authedApi(`/admin/licenses/${licenseId}/verify`, {
        method: "PATCH",
        body: JSON.stringify({
          status: approve ? "approved" : "rejected",
          notes: approve ? "Verified by admin" : "Rejected by admin",
        }),
      });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionId(null);
    }
  }

  const pages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>
      <div className="card overflow-hidden">
        <table className="table-auto w-full">
          <thead className="bg-gray-50">
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Verified</th>
              <th>License</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">Loading…</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-xs text-gray-500">{c.email}</td>
                <td className="text-xs">{c.phone ?? "—"}</td>
                <td>
                  <span className={c.isVerified ? "badge-green" : "badge-gray"}>
                    {c.isVerified ? "Yes" : "No"}
                  </span>
                </td>
                <td>
                  {c.license ? (
                    <span className={LICENSE_BADGE[c.license.status] ?? "badge-gray"}>
                      {c.license.status}
                    </span>
                  ) : (
                    <span className="badge-gray">None</span>
                  )}
                </td>
                <td className="text-xs">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td>
                  {c.license?.status === "pending" && (
                    <div className="flex gap-1">
                      <button
                        disabled={actionId === c.license.id}
                        onClick={() => verifyLicense(c.license!.id, true)}
                        className="btn-success px-2 py-1 text-xs"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actionId === c.license.id}
                        onClick={() => verifyLicense(c.license!.id, false)}
                        className="btn-danger px-2 py-1 text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
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
