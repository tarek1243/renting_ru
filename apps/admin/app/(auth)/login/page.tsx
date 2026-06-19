"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { storeSession } from "../../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@renting.ru");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const BASE = (window as any).__API_URL__ ?? process.env.NEXT_PUBLIC_API_URL ?? "https://rentingapi-production.up.railway.app/api/v1"; // "http://localhost:4000/api/v1"
      const res = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Invalid credentials");
        return;
      }
      const { accessToken, refreshToken, user } = body.data;
      const roles: string[] = user.roles ?? [];
      if (!roles.includes("staff") && !roles.includes("super_admin")) {
        setError("You do not have admin access.");
        return;
      }
      storeSession({ accessToken, refreshToken, user: { ...user, role: roles[0] } });
      router.replace("/dashboard");
    } catch {
      setError("Network error — is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="card p-8">
          <h1 className="mb-6 text-center text-2xl font-bold text-indigo-600">
            Renting Admin
          </h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email" type="email" className="input mt-1"
                value={email} onChange={(e) => setEmail(e.target.value)}
                required autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password" type="password" className="input mt-1"
                value={password} onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
