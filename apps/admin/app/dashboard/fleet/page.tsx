"use client";

import { useEffect, useState } from "react";
import { authedApi } from "../../../lib/auth";
import { ListingStatus } from "@renting/shared";

interface Listing {
  id: string;
  slug: string;
  title: object;
  status: ListingStatus;
  category: { slug: string; name: object };
  dailyRate?: number;
  currency?: string;
  viewCount: number;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "badge-gray",
  active: "badge-green",
  suspended: "badge-yellow",
  archived: "badge-red",
};

export default function FleetPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await authedApi<any>(`/admin/listings?page=${page}&perPage=20`);
      setListings(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(id: string, status: string) {
    setActionId(id);
    try {
      await authedApi(`/admin/listings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionId(null);
    }
  }

  async function deleteListing(id: string) {
    if (!confirm("Delete this listing?")) return;
    setActionId(id);
    try {
      await authedApi(`/admin/listings/${id}`, { method: "DELETE" });
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
        <h1 className="text-2xl font-bold">Fleet</h1>
        <span className="text-sm text-gray-500">{total} listings</span>
      </div>

      <div className="card overflow-hidden">
        <table className="table-auto w-full">
          <thead className="bg-gray-50">
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Views</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400">Loading…</td></tr>
            ) : listings.map((l) => (
              <tr key={l.id}>
                <td className="font-medium">
                  {typeof l.title === "object" ? (l.title as any).en : String(l.title)}
                </td>
                <td className="text-xs text-gray-500">
                  {typeof l.category?.name === "object"
                    ? (l.category.name as any).en
                    : l.category?.slug}
                </td>
                <td>
                  <span className={STATUS_BADGE[l.status] ?? "badge-gray"}>{l.status}</span>
                </td>
                <td>{l.viewCount}</td>
                <td>
                  <div className="flex gap-1">
                    {l.status !== "active" && (
                      <button
                        disabled={actionId === l.id}
                        onClick={() => setStatus(l.id, "active")}
                        className="btn-success px-2 py-1 text-xs"
                      >
                        Activate
                      </button>
                    )}
                    {l.status === "active" && (
                      <button
                        disabled={actionId === l.id}
                        onClick={() => setStatus(l.id, "suspended")}
                        className="btn-secondary px-2 py-1 text-xs"
                      >
                        Suspend
                      </button>
                    )}
                    <button
                      disabled={actionId === l.id}
                      onClick={() => deleteListing(l.id)}
                      className="btn-danger px-2 py-1 text-xs"
                    >
                      Delete
                    </button>
                  </div>
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
