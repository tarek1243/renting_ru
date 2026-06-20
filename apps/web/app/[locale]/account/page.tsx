"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { API_URL } from "../../../lib/api";
import { authedApi, getAccessToken, getUser } from "../../../lib/auth";
import { ui } from "../../../lib/i18n";

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function uploadFile(file: File, token: string | null): Promise<string> {
  const data = await readAsDataURL(file);
  const res = await fetch(`${API_URL}/media/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data, name: file.name }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Upload failed");
  const raw: string = json.data.url;
  return raw.startsWith("http") ? raw : `${API_URL.replace("/api/v1", "")}${raw}`;
}

export default function AccountPage() {
  const { locale } = useParams<{ locale: string }>();
  const T = ui(locale);
  const router = useRouter();
  const [profile, setProfile] = useState<any | null>(null);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseCountry, setLicenseCountry] = useState("SA");
  const defaultExpiry = new Date();
  defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 5);
  const [licenseExpiry, setLicenseExpiry] = useState(defaultExpiry.toISOString().slice(0, 10));
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!getUser()) {
      router.push(`/${locale}/login?next=/${locale}/account`);
      return;
    }
    authedApi<any>("/me").then(({ data }) => setProfile(data)).catch((e) => setError(e.message));
  }, [locale, router]);

  const saveProfile = async () => {
    setError(null);
    try {
      await authedApi("/me", {
        method: "PATCH",
        body: { firstName: profile.firstName, lastName: profile.lastName, locale: profile.locale, preferredCurrency: profile.preferredCurrency },
      });
      setMessage("✓");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const submitLicense = async () => {
    if (!licenseNumber || !licenseExpiry || !frontFile) {
      setError("License number, expiry date and front image are required.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const token = getAccessToken();
      const frontUrl = await uploadFile(frontFile, token);
      const backUrl = backFile ? await uploadFile(backFile, token) : undefined;
      await authedApi("/me/license", {
        method: "POST",
        body: { number: licenseNumber, country: licenseCountry, expiresOn: licenseExpiry, frontImageUrl: frontUrl, backImageUrl: backUrl },
      });
      setMessage(T("uploaded"));
      const { data } = await authedApi<any>("/me");
      setProfile(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  if (!profile) return <p className="py-20 text-center text-gray-400">{T("loading")}</p>;

  const licenseStatus = profile.license?.status ?? "not_submitted";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="card space-y-3 p-6">
        <h1 className="text-xl font-bold">{T("profile")}</h1>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{T("firstName")}</label>
            <input className="input" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
          </div>
          <div>
            <label className="label">{T("lastName")}</label>
            <input className="input" value={profile.lastName ?? ""} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
          </div>
          <div>
            <label className="label">{T("email")}</label>
            <input className="input" value={profile.email ?? ""} disabled />
          </div>
          <div>
            <label className="label">{T("phone")}</label>
            <input className="input" value={profile.phone ?? ""} disabled />
          </div>
        </div>
        <button className="btn-primary" onClick={saveProfile}>{T("save")}</button>
      </section>

      <section className="card space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{T("license")}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            licenseStatus === "approved" ? "bg-green-50 text-green-700"
            : licenseStatus === "pending" ? "bg-amber-50 text-amber-700"
            : licenseStatus === "rejected" ? "bg-red-50 text-red-700"
            : "bg-gray-100 text-gray-500"}`}>
            {licenseStatus}
          </span>
        </div>

        {profile.license?.rejectReason && (
          <p className="text-sm text-red-600">{profile.license.rejectReason}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">License number</label>
            <input className="input" placeholder="AB123456" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
          </div>
          <div>
            <label className="label">Country</label>
            <input className="input" placeholder="RU" maxLength={2} value={licenseCountry} onChange={(e) => setLicenseCountry(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="label">Expiry date</label>
            <input className="input" type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />
          </div>
        </div>

        {/* Front image */}
        <div>
          <label className="label">Front side <span className="text-red-500">*</span></label>
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 transition hover:border-brand-400"
            onClick={() => frontRef.current?.click()}
          >
            {frontFile ? (
              <p className="text-sm font-medium text-brand-600">{frontFile.name}</p>
            ) : (
              <>
                <p className="text-sm text-gray-500">Click to attach front of license</p>
                <p className="text-xs text-gray-400">JPEG, PNG, WEBP or PDF · max 10 MB</p>
              </>
            )}
          </div>
          <input ref={frontRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
            onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)} />
        </div>

        {/* Back image */}
        <div>
          <label className="label">Back side <span className="text-gray-400 text-xs">(optional)</span></label>
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 transition hover:border-brand-400"
            onClick={() => backRef.current?.click()}
          >
            {backFile ? (
              <p className="text-sm font-medium text-brand-600">{backFile.name}</p>
            ) : (
              <p className="text-sm text-gray-500">Click to attach back of license</p>
            )}
          </div>
          <input ref={backRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
            onChange={(e) => setBackFile(e.target.files?.[0] ?? null)} />
        </div>

        <button
          className="btn-secondary"
          onClick={submitLicense}
          disabled={uploading || !licenseNumber || !licenseExpiry || !frontFile}
        >
          {uploading ? "Uploading…" : T("save")}
        </button>
      </section>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
