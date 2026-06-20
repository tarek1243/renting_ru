"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getUser, type SessionUser } from "../lib/auth";
import { LOCALES, ui } from "../lib/i18n";

const LOCALE_LABELS: Record<string, string> = { en: "EN", ar: "AR" };

function CarIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
    </svg>
  );
}

function UserAvatar({ name }: { name: string }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white ring-2 ring-white">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Header({
  locale,
  categories,
}: {
  locale: string;
  categories: Array<{ slug: string; label: string }>;
}) {
  const T = ui(locale);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
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
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex shrink-0 items-center gap-2 text-lg font-extrabold text-brand-600">
          <CarIcon />
          <span>Renting</span>
        </Link>

        {/* Desktop category nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/${locale}/${c.slug}`}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              {c.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          {/* Language switcher */}
          <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => switchLocale(l)}
                className={`px-2.5 py-1 text-xs font-semibold transition ${
                  l === locale
                    ? "bg-brand-600 text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                {LOCALE_LABELS[l] ?? l.toUpperCase()}
              </button>
            ))}
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/${locale}/account/bookings`}
                className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 md:block"
              >
                {T("myBookings")}
              </Link>
              <Link href={`/${locale}/account`} className="flex items-center gap-2">
                <UserAvatar name={user.firstName} />
              </Link>
              <button
                className="hidden rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700 md:block"
                onClick={() => {
                  clearSession();
                  router.push(`/${locale}`);
                }}
              >
                {T("logout")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href={`/${locale}/login`}
                className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 md:block"
              >
                {T("login")}
              </Link>
              <Link href={`/${locale}/register`} className="btn-primary !px-4 !py-1.5 text-xs">
                {T("register")}
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/${locale}/${c.slug}`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileOpen(false)}
              >
                {c.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link href={`/${locale}/account/bookings`} className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
                  {T("myBookings")}
                </Link>
                <Link href={`/${locale}/account`} className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
                  {user.firstName}
                </Link>
                <button className="rounded-lg px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50" onClick={() => { clearSession(); router.push(`/${locale}`); setMobileOpen(false); }}>
                  {T("logout")}
                </button>
              </>
            ) : (
              <Link href={`/${locale}/login`} className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
                {T("login")}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
