import Link from "next/link";
import { ui } from "../lib/i18n";

export function Footer({ locale }: { locale: string }) {
  const T = ui(locale);
  return (
    <footer className="mt-12 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-gray-500">
        <span>© {new Date().getFullYear()} Renting platform</span>
        <nav className="flex gap-4">
          <Link href={`/${locale}/pages/terms`} className="hover:text-gray-800">{T("terms")}</Link>
          <Link href={`/${locale}/faq`} className="hover:text-gray-800">{T("faq")}</Link>
        </nav>
      </div>
    </footer>
  );
}
