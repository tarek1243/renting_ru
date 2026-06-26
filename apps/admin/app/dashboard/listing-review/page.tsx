"use client";

import { useEffect, useState } from "react";
import { authedApi } from "../../../lib/auth";

interface Listing {
  id: string;
  slug: string;
  title: Record<string, string>;
  description?: Record<string, string>;
  status: string;
  city?: string;
  neighborhood?: string;
  withDriverAvailable: boolean;
  selfDriveAvailable: boolean;
  moderationStatus: string;
  moderationWarnings?: {
    warnings?: Array<{ category: string; message: string; severity: string }>;
    score?: number;
  };
  owner?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    gender?: string;
    ownerApprovalStatus: string;
  };
  category?: { slug: string; name: Record<string, string> };
  prices: Array<{ pricingUnit: string; currency: string; basePrice: string | number }>;
  media: Array<{ url: string; isCover: boolean; sortOrder: number }>;
}

function text(value: Record<string, string> | undefined, fallback = "") {
  return value?.en ?? Object.values(value ?? {})[0] ?? fallback;
}

export default function ListingReviewPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await authedApi<any>("/admin/listings-review?perPage=50");
      setListings(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    if (!confirm("Approve and publish this listing now?")) return;
    setActionId(id);
    try {
      await authedApi(`/admin/listings/${id}/approve`, { method: "POST" });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: string) {
    const reason = prompt("Reason for rejection");
    if (reason === null) return;
    setActionId(id);
    try {
      await authedApi(`/admin/listings/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || "Listing did not meet marketplace requirements" }),
      });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionId(null);
    }
  }

  async function moderate(id: string) {
    setActionId(id);
    try {
      await authedApi(`/admin/listings/${id}/moderate`, { method: "POST" });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Listing Review</h1>
        <span className="text-sm text-gray-500">{total} pending</span>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : listings.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400">No listings waiting for review.</div>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => {
            const warnings = listing.moderationWarnings?.warnings ?? [];
            return (
              <article key={listing.id} className="card overflow-hidden">
                <div className="grid gap-4 p-5 lg:grid-cols-[220px_1fr_220px]">
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                    {(listing.media.length ? listing.media : [{ url: "" } as any]).slice(0, 4).map((m, index) => (
                      <div key={`${m.url}-${index}`} className="aspect-video overflow-hidden rounded-lg bg-gray-100">
                        {m.url ? <img src={m.url} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="badge-yellow">{listing.status}</span>
                        <span className="badge-gray">{listing.moderationStatus}</span>
                        <span className="badge-gray">{listing.owner?.gender ?? "gender missing"}</span>
                      </div>
                      <h2 className="text-lg font-semibold">{text(listing.title, listing.slug)}</h2>
                      <p className="mt-1 text-sm text-gray-500">{text(listing.description)}</p>
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400">Owner</p>
                        <p>{listing.owner ? `${listing.owner.firstName} ${listing.owner.lastName}`.trim() : "No owner"}</p>
                        <p className="text-xs text-gray-500">{listing.owner?.email ?? listing.owner?.phone}</p>
                        <p className="text-xs text-gray-500">Approval: {listing.owner?.ownerApprovalStatus ?? "n/a"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400">Location</p>
                        <p>{[listing.city, listing.neighborhood].filter(Boolean).join(", ") || "Missing"}</p>
                        <p className="text-xs text-gray-500">
                          {listing.withDriverAvailable ? "With driver" : ""}
                          {listing.withDriverAvailable && listing.selfDriveAvailable ? " / " : ""}
                          {listing.selfDriveAvailable ? "Without driver" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {listing.prices.map((p) => (
                        <span key={`${p.pricingUnit}-${p.currency}`} className="rounded-lg border border-gray-200 px-3 py-1 text-xs">
                          {p.pricingUnit}: {String(p.basePrice)} {p.currency}
                        </span>
                      ))}
                    </div>

                    {warnings.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <p className="mb-2 font-semibold">AI warnings</p>
                        <ul className="space-y-1">
                          {warnings.map((w, index) => (
                            <li key={index}>{w.severity}: {w.category} - {w.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button disabled={actionId === listing.id} onClick={() => approve(listing.id)} className="btn-success justify-center">
                      Approve
                    </button>
                    <button disabled={actionId === listing.id} onClick={() => reject(listing.id)} className="btn-danger justify-center">
                      Reject
                    </button>
                    <button disabled={actionId === listing.id} onClick={() => moderate(listing.id)} className="btn-secondary justify-center">
                      Rerun AI
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
