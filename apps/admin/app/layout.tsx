import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Admin — Renting.ru", template: "%s | Admin" },
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "https://rentingapi-production.up.railway.app/api/v1"; // "http://localhost:4000/api/v1"
  return (
    <html lang="en">
      <head>
        {/* Inject API URL at runtime from the server so client bundles don't need it baked in */}
        <script dangerouslySetInnerHTML={{ __html: `window.__API_URL__=${JSON.stringify(apiUrl)}` }} />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
