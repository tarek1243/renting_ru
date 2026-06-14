"use client";

import { useEffect, useState } from "react";
import { authedApi } from "../../../lib/auth";
import { ReviewStatus } from "@renting/shared";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
  author: { name: string } | null;
  listing: { title: object } | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-yellow",
  approved: "badge-green",
  rejected: "badge-red",
  flagged: "badge-red",
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), perPage: "20" });
      if (statusFilter) qs.set("status", statusFilter);
      const res = await authedApi<any>(`/admin/reviews?${qs}`);
      setReviews(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, statusFilter]); // eslint-disable-line

  async function moderate(id: string, status: string) {
    setActionId(id);
    try {
      await authedApi(`/admin/reviews/${id}`, {
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

  const pages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reviews</h1>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input w-40"
        >
          <option value="">All</option>
          {Object.values(ReviewStatus).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="card overflow-hidden">
        <table className="table-auto w-full">
          <thead className="bg-gray-50">
            <tr>
              <th>Listing</th>
              <th>Author</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">Loading…</td></tr>
            ) : reviews.map((r) => (
              <tr key={r.id}>
                <td className="max-w-[120px] truncate text-xs">
                  {r.listing
                    ? (typeof r.listing.title === "object"
                        ? (r.listing.title as any).en
                        : String(r.listing.title))
                    : "—"}
                </td>
                <td>{r.author?.name ?? "—"}</td>
                <td>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</td>
                <td className="max-w-[200px] truncate text-xs">{r.comment ?? "—"}</td>
                <td>
                  <span className={STATUS_BADGE[r.status] ?? "badge-gray"}>{r.status}</span>
                </td>
                <td className="text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="flex gap-1">
                    {r.status !== "approved" && (
                      <button
                        disabled={actionId === r.id}
                        onClick={() => moderate(r.id, "approved")}
                        className="btn-success px-2 py-1 text-xs"
                      >
                        Approve
                      </button>
                    )}
                    {r.status !== "rejected" && (
                      <button
                        disabled={actionId === r.id}
                        onClick={() => moderate(r.id, "rejected")}
                        className="btn-danger px-2 py-1 text-xs"
                      >
                        Reject
                      </button>
                    )}
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
            <button key={p} onClick={() => setPage(p)}
              className={p === page ? "btn-primary px-3 py-1" : "btn-secondary px-3 py-1"}
            >{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
