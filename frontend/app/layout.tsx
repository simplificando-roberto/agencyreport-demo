"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/";

  const nav = [
    { href: "/dashboard/", label: "Dashboard" },
    { href: "/reports/", label: "Reportes" },
    { href: "/ai/", label: "Chat IA" },
  ];

  return (
    <html lang="es">
      <head><title>AgencyReport</title></head>
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        {isLogin ? children : (
          <>
            <header className="bg-white shadow-sm border-b border-gray-200">
              <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <Link href="/dashboard/" className="text-xl font-bold text-blue-600">AgencyReport</Link>
                  <nav className="flex gap-1">
                    {nav.map(n => (
                      <Link key={n.href} href={n.href}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          pathname?.startsWith(n.href.replace(/\/$/, "")) ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                        }`}>
                        {n.label}
                      </Link>
                    ))}
                  </nav>
                </div>
                <button onClick={() => { localStorage.clear(); window.location.href = "/"; }}
                  className="text-sm text-gray-500 hover:text-red-500 transition-colors">
                  Cerrar sesion
                </button>
              </div>
            </header>
            <main className="max-w-6xl mx-auto p-6">{children}</main>
          </>
        )}
      </body>
    </html>
  );
}
