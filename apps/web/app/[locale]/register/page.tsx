"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../lib/api";
import { storeSession } from "../../../lib/auth";
import { ui } from "../../../lib/i18n";

export default function RegisterPage() {
  const { locale } = useParams<{ locale: string }>();
  const T = ui(locale);
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", gender: "male" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setSelect = (key: string) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<any>("/auth/register", {
        method: "POST",
        body: { ...form, phone: form.phone || undefined, email: form.email || undefined },
      });
      storeSession(data);
      router.push(`/${locale}`);
    } catch (e: any) {
      setError(e.details ? `${e.message}: ${JSON.stringify(e.details)}` : e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card space-y-3 p-6">
        <h1 className="text-xl font-bold">{T("register")}</h1>
        <input className="input" placeholder={T("firstName")} value={form.firstName} onChange={set("firstName")} />
        <input className="input" placeholder={T("lastName")} value={form.lastName} onChange={set("lastName")} />
        <input className="input" type="email" placeholder={T("email")} value={form.email} onChange={set("email")} />
        <input className="input" placeholder={`${T("phone")} (+7…)`} value={form.phone} onChange={set("phone")} />
        <select className="input" value={form.gender} onChange={setSelect("gender")}>
          <option value="male">{locale === "ar" ? "ذكر" : "Male"}</option>
          <option value="female">{locale === "ar" ? "أنثى" : "Female"}</option>
        </select>
        <input className="input" type="password" placeholder={T("password")} value={form.password} onChange={set("password")} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" onClick={submit} disabled={busy}>
          {busy ? T("loading") : T("register")}
        </button>
      </div>
    </div>
  );
}
