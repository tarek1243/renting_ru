"use client";

import Link from "next/link";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "../../../lib/api";
import { storeSession } from "../../../lib/auth";
import { ui } from "../../../lib/i18n";

function LoginForm() {
  const { locale } = useParams<{ locale: string }>();
  const T = ui(locale);
  const router = useRouter();
  const search = useSearchParams();
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = (data: any) => {
    storeSession(data);
    router.push(search.get("next") ?? `/${locale}`);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "password") {
        const { data } = await api<any>("/auth/login", { method: "POST", body: { identifier, password } });
        finish(data);
      } else if (!otpSent) {
        await api("/auth/otp/request", { method: "POST", body: { phone } });
        setOtpSent(true);
      } else {
        const { data } = await api<any>("/auth/otp/verify", { method: "POST", body: { phone, code } });
        finish(data);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card space-y-4 p-6">
        <h1 className="text-xl font-bold">{T("login")}</h1>
        <div className="flex gap-2 text-sm">
          <button className={`flex-1 rounded-lg border px-3 py-1.5 ${mode === "password" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200"}`} onClick={() => setMode("password")}>
            {T("email")}
          </button>
          <button className={`flex-1 rounded-lg border px-3 py-1.5 ${mode === "otp" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200"}`} onClick={() => setMode("otp")}>
            SMS
          </button>
        </div>

        {mode === "password" ? (
          <>
            <input className="input" placeholder={`${T("email")} / ${T("phone")}`} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            <input className="input" type="password" placeholder={T("password")} value={password} onChange={(e) => setPassword(e.target.value)} />
          </>
        ) : (
          <>
            <input className="input" placeholder="+7 900 000 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={otpSent} />
            {otpSent && <input className="input" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />}
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" onClick={submit} disabled={busy}>
          {busy ? T("loading") : mode === "otp" && !otpSent ? "Send code" : T("login")}
        </button>
        <p className="text-center text-sm text-gray-500">
          <Link href={`/${locale}/register`} className="text-brand-600 hover:underline">{T("register")}</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
