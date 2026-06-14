"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getUser, type SessionUser } from "../lib/auth";
import { LOCALES, ui } from "../lib/i18n";

export function Header({
  locale,
  categories,
}: {
  locale: string;
  categories: Array<{ slug: string; label: string }>;
}) {
  const T = ui(locale);
  const [user, setUser] = useState<SessionUser | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const sync = () => setUser(getUser());
    sync();
    window.addEventListener("renting:auth", sync);
    return () => window.removeEventListener("renting:auth", sync);
  }, []);

  const switchLocale = (next: string) => {
    const parts = pathname.split("/");
    parts[1] = next;
    router.push(parts.join("/") || `/${next}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href={`/${locale}`} className="text-lg font-bold text-brand-600">
          Renting
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {categories.map((c) => (
            <Link key={c.slug} href={`/${locale}/${c.slug}`} className="text-gray-600 hover:text-brand-600">
              {c.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-3 text-sm">
          <select
            aria-label="Language"
            className="rounded border border-gray-200 bg-white px-1.5 py-1 text-xs"
            value={locale}
            onChange={(e) => switchLocale(e.target.value)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
          {user ? (
            <>
              <Link href={`/${locale}/account/bookings`} className="text-gray-600 hover:text-brand-600">
                {T("myBookings")}
              </Link>
              <Link href={`/${locale}/account`} className="font-medium text-gray-800 hover:text-brand-600">
                {user.firstName}
              </Link>
              <button
                className="text-gray-400 hover:text-gray-700"
                onClick={() => {
                  clearSession();
                  router.push(`/${locale}`);
                }}
              >
                {T("logout")}
              </button>
            </>
          ) : (
            <>
              <Link href={`/${locale}/login`} className="text-gray-600 hover:text-brand-600">
                {T("login")}
              </Link>
              <Link href={`/${locale}/register`} className="btn-primary !py-1.5">
                {T("register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
