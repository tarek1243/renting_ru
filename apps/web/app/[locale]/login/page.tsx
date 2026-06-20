"use client";

import Link from "next/link";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "../../../lib/api";
import { storeSession } from "../../../lib/auth";
import { ui } from "../../../lib/i18n";

function CarIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
    </svg>
  );
}

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
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
            <CarIcon />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">{T("login")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {locale === "ar" ? "مرحباً بك مجدداً" : "Welcome back"}
          </p>
        </div>

        <div className="card space-y-5 p-6">
          {/* Mode toggle */}
          <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <button
              className={`flex-1 py-2 text-sm font-semibold transition ${mode === "password" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setMode("password")}
            >
              {T("email")} / {T("phone")}
            </button>
            <button
              className={`flex-1 py-2 text-sm font-semibold transition ${mode === "otp" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setMode("otp")}
            >
              SMS OTP
            </button>
          </div>

          {mode === "password" ? (
            <div className="space-y-3">
              <div>
                <label className="label">{T("email")} / {T("phone")}</label>
                <input
                  className="input"
                  placeholder="email@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="label">{T("password")}</label>
                <input
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  autoComplete="current-password"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">{T("phone")}</label>
                <input
                  className="input"
                  placeholder="+7 900 000 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={otpSent}
                />
              </div>
              {otpSent && (
                <div>
                  <label className="label">Code</label>
                  <input
                    className="input tracking-[0.5em] text-center text-lg"
                    placeholder="000000"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button className="btn-primary w-full py-3 text-base" onClick={submit} disabled={busy}>
            {busy ? T("loading") : mode === "otp" && !otpSent ? "Send code" : T("login")}
          </button>

          <p className="text-center text-sm text-gray-500">
            {locale === "ar" ? "ليس لديك حساب؟" : "Don't have an account?"}{" "}
            <Link href={`/${locale}/register`} className="font-semibold text-brand-600 hover:underline">
              {T("register")}
            </Link>
          </p>
        </div>
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
