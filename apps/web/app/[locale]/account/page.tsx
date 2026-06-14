"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authedApi, getUser } from "../../../lib/auth";
import { ui } from "../../../lib/i18n";

export default function AccountPage() {
  const { locale } = useParams<{ locale: string }>();
  const T = ui(locale);
  const router = useRouter();
  const [profile, setProfile] = useState<any | null>(null);
  const [license, setLicense] = useState({ number: "", country: "RU", expiresOn: "", frontImageUrl: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      // In production the image goes to S3 via POST /media/presign; a URL field keeps local dev simple.
      await authedApi("/me/license", {
        method: "POST",
        body: { ...license, frontImageUrl: license.frontImageUrl || "https://example.com/license-front.jpg" },
      });
      setMessage(T("uploaded"));
      const { data } = await authedApi<any>("/me");
      setProfile(data);
    } catch (e: any) {
      setError(e.message);
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

      <section className="card space-y-3 p-6">
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
        {profile.license?.rejectReason && <p className="text-sm text-red-600">{profile.license.rejectReason}</p>}
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="License number" value={license.number} onChange={(e) => setLicense({ ...license, number: e.target.value })} />
          <input className="input" placeholder="Country (RU)" value={license.country} onChange={(e) => setLicense({ ...license, country: e.target.value })} />
          <input className="input" type="date" value={license.expiresOn} onChange={(e) => setLicense({ ...license, expiresOn: e.target.value })} />
          <input className="input" placeholder="Front image URL" value={license.frontImageUrl} onChange={(e) => setLicense({ ...license, frontImageUrl: e.target.value })} />
        </div>
        <button className="btn-secondary" onClick={submitLicense} disabled={!license.number || !license.expiresOn}>
          {T("save")}
        </button>
      </section>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
