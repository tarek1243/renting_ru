"use client";

import { useEffect, useState } from "react";
import { authedApi } from "../../../lib/auth";

interface CategoryAttribute {
  id: string;
  key: string;
  label: object;
  dataType: string;
  filterWidget: string;
  isRequired: boolean;
  options: string[] | null;
}

interface Category {
  id: string;
  slug: string;
  name: object;
  isEnabled: boolean;
  icon: string | null;
  attributes: CategoryAttribute[];
  pricingUnits: { id: string; unit: string; isDefault: boolean }[];
}

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [selected, setSelected] = useState<Category | null>(null);
  const [newCatSlug, setNewCatSlug] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await authedApi<any>("/admin/categories");
      setCats(res.items ?? res ?? []);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggle(id: string, current: boolean) {
    setToggling(id);
    try {
      await authedApi(`/admin/categories/${id}/toggle`, { method: "PATCH" });
      setCats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isEnabled: !current } : c)),
      );
      if (selected?.id === id) setSelected((s) => s ? { ...s, isEnabled: !current } : s);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setToggling(null);
    }
  }

  async function createCategory() {
    if (!newCatSlug || !newCatName) return;
    setCreating(true);
    try {
      await authedApi("/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          slug: newCatSlug,
          name: { en: newCatName, ru: newCatName, ar: newCatName },
          isEnabled: false,
        }),
      });
      setNewCatSlug("");
      setNewCatName("");
      setShowNew(false);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button onClick={() => setShowNew(!showNew)} className="btn-primary">
          + New Category
        </button>
      </div>

      {showNew && (
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">New Category</h2>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Slug</label>
              <input
                className="input mt-1"
                placeholder="real-estate"
                value={newCatSlug}
                onChange={(e) => setNewCatSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              />
            </div>
            <div className="flex-1">
              <label className="label">Name (EN)</label>
              <input
                className="input mt-1"
                placeholder="Real Estate"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button onClick={createCategory} disabled={creating} className="btn-primary">
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            New categories are disabled by default — add attributes then toggle on.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category list */}
        <div className="card overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-500">
            {cats.length} categories
          </div>
          {loading ? (
            <p className="p-6 text-center text-gray-400">Loading…</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {cats.map((cat) => (
                <li
                  key={cat.id}
                  className={`flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-gray-50 ${
                    selected?.id === cat.id ? "bg-indigo-50" : ""
                  }`}
                  onClick={() => setSelected(cat)}
                >
                  <div>
                    <p className="font-medium">
                      {typeof cat.name === "object" ? (cat.name as any).en : cat.name}
                    </p>
                    <p className="text-xs text-gray-400">/{cat.slug}</p>
                  </div>
                  {/* The isEnabled toggle — hides/exposes the entire category */}
                  <button
                    disabled={toggling === cat.id}
                    onClick={(e) => { e.stopPropagation(); toggle(cat.id, cat.isEnabled); }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                      cat.isEnabled ? "bg-indigo-600" : "bg-gray-300"
                    }`}
                    title={cat.isEnabled ? "Click to disable" : "Click to enable"}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        cat.isEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Category detail — attributes & pricing units */}
        {selected ? (
          <div className="space-y-3">
            <div className="card p-4">
              <h2 className="mb-1 font-semibold">
                {typeof selected.name === "object"
                  ? (selected.name as any).en
                  : selected.name}
              </h2>
              <p className="text-xs text-gray-400">
                Status:{" "}
                <span className={selected.isEnabled ? "text-green-600" : "text-gray-500"}>
                  {selected.isEnabled ? "Enabled (visible to customers)" : "Disabled (hidden)"}
                </span>
              </p>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <span className="text-sm font-semibold">Attributes ({selected.attributes.length})</span>
              </div>
              {selected.attributes.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">No attributes yet.</p>
              ) : (
                <table className="table-auto w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th>Key</th>
                      <th>Type</th>
                      <th>Widget</th>
                      <th>Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.attributes.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono">{a.key}</td>
                        <td>{a.dataType}</td>
                        <td>{a.filterWidget}</td>
                        <td>{a.isRequired ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card p-4">
              <p className="mb-2 text-sm font-semibold">Pricing Units</p>
              {selected.pricingUnits.length === 0 ? (
                <p className="text-sm text-gray-400">No pricing units.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selected.pricingUnits.map((u) => (
                    <span key={u.id} className={u.isDefault ? "badge-blue" : "badge-gray"}>
                      {u.unit}{u.isDefault ? " (default)" : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card flex items-center justify-center p-12 text-gray-400">
            Click a category to view details
          </div>
        )}
      </div>
    </div>
  );
}
