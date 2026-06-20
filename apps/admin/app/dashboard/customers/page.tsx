"use client";

import { useEffect, useState } from "react";
import { authedApi } from "../../../lib/auth";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  license: { status: string; country: string; expiresOn: string | null } | null;
  _count: { bookings: number };
}

const LICENSE_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
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
      const res = await authedApi<any>(`/admin/customers?page=${page - 1}&perPage=20`);
      setCustomers(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]); // eslint-disable-line

  async function decideOnLicense(customerId: string, approve: boolean) {
    setActionId(customerId);
    try {
      await authedApi(`/admin/customers/${customerId}/license/${approve ? "approve" : "reject"}`, {
        method: "POST",
        body: JSON.stringify(approve ? {} : { reason: "Rejected by admin" }),
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
        <table className="w-full table-auto text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Email</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Phone</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">License</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Bookings</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Joined</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">No customers yet.</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 font-medium">{c.firstName} {c.lastName}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{c.email ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{c.phone ?? "—"}</td>
                <td className="px-4 py-2">
                  {c.license ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LICENSE_BADGE[c.license.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {c.license.status}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">None</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">{c._count.bookings}</td>
                <td className="px-4 py-2 text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2">
                  {c.license?.status === "pending" && (
                    <div className="flex gap-1">
                      <button
                        disabled={actionId === c.id}
                        onClick={() => decideOnLicense(c.id, true)}
                        className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actionId === c.id}
                        onClick={() => decideOnLicense(c.id, false)}
                        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
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
            <button key={p} onClick={() => setPage(p)}
              className={`rounded px-3 py-1 text-sm ${p === page ? "bg-indigo-600 text-white" : "border border-gray-200 text-gray-600"}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
