"use client";

import { useEffect, useState } from "react";
import { authedApi } from "../../../lib/auth";

interface Setting {
  key: string;
  value: unknown;
  description: string | null;
  isPublic: boolean;
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function parseSettingValue(key: string, value: string): unknown {
  if (key === "ai_moderation_enabled") return value === "true";
  const trimmed = value.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

const EDITABLE_KEYS = [
  "default_currency",
  "supported_currencies",
  "tax_percent",
  "company_name",
  "support_email",
  "support_phone",
  "ai_moderation_enabled",
  "openrouter_model",
  "openrouter_api_key",
];

const DEFAULT_SETTINGS: Setting[] = [
  { key: "ai_moderation_enabled", value: false, description: "Enable OpenRouter listing moderation", isPublic: false },
  { key: "openrouter_model", value: "openai/gpt-4o-mini", description: "OpenRouter model used for listing moderation", isPublic: false },
  { key: "openrouter_api_key", value: "", description: "Optional OpenRouter API key; env OPENROUTER_API_KEY also works", isPublic: false },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await authedApi<Setting[]>("/admin/settings");
      const rows = Array.isArray(res) ? res : [];
      const existing = new Set(rows.map((s) => s.key));
      setSettings([...rows, ...DEFAULT_SETTINGS.filter((s) => !existing.has(s.key))]);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(key: string) {
    const value = editing[key];
    if (value === undefined) return;
    setSaving(key);
    try {
      await authedApi(`/admin/settings/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value: parseSettingValue(key, value) }),
      });
      setSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value: parseSettingValue(key, value) } : s)),
      );
      setEditing((prev) => { const n = { ...prev }; delete n[key]; return n; });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(null);
    }
  }

  const grouped = {
    editable: settings.filter((s) => EDITABLE_KEYS.includes(s.key)),
    other: settings.filter((s) => !EDITABLE_KEYS.includes(s.key)),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-3 text-sm font-semibold">
              Editable Settings
            </div>
            <div className="divide-y divide-gray-100">
              {grouped.editable.map((s) => (
                <div key={s.key} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-52 shrink-0">
                    <p className="font-mono text-sm font-medium">{s.key}</p>
                    {s.description && (
                      <p className="text-xs text-gray-400">{s.description}</p>
                    )}
                  </div>
                  <input
                    className="input flex-1"
                    value={editing[s.key] ?? displayValue(s.value)}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [s.key]: e.target.value }))
                    }
                  />
                  <button
                    disabled={editing[s.key] === undefined || saving === s.key}
                    onClick={() => save(s.key)}
                    className="btn-primary px-3 py-2 text-xs disabled:opacity-40"
                  >
                    {saving === s.key ? "Saving…" : "Save"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {grouped.other.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-500">
                System Settings (read-only)
              </div>
              <table className="table-auto w-full text-xs">
                <thead className="bg-gray-50">
                  <tr><th>Key</th><th>Value</th><th>Public</th></tr>
                </thead>
                <tbody>
                  {grouped.other.map((s) => (
                    <tr key={s.key}>
                      <td className="font-mono">{s.key}</td>
                      <td className="max-w-xs truncate">{displayValue(s.value)}</td>
                      <td>{s.isPublic ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
