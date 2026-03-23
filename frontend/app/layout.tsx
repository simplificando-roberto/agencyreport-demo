"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { logout, getAgencyName } from "../lib/api";

const NAV = [
  { href: "/dashboard/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/reports/", label: "Reportes", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { href: "/ai/", label: "Asistente IA", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/";

  return (
    <html lang="es">
      <head><title>AgencyReport</title></head>
      <body>
        {isLogin ? children : (
          <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="w-64 shrink-0 flex flex-col" style={{ background: "var(--bg-sidebar)" }}>
              {/* Logo */}
              <div className="p-6 pb-2">
                <Link href="/dashboard/" className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: "var(--accent)" }}>AR</div>
                  <div>
                    <div className="text-white font-semibold text-sm tracking-tight">AgencyReport</div>
                    <div className="text-[11px] text-gray-500">{getAgencyName()}</div>
                  </div>
                </Link>
              </div>

              {/* Nav */}
              <nav className="flex-1 px-3 py-4 space-y-1">
                {NAV.map(n => {
                  const active = pathname?.startsWith(n.href.replace(/\/$/, ""));
                  return (
                    <Link key={n.href} href={n.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        active ? "sidebar-active font-medium" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                      }`}>
                      <NavIcon d={n.icon} />
                      {n.label}
                    </Link>
                  );
                })}
              </nav>

              {/* Bottom */}
              <div className="p-4 border-t border-white/5">
                <Link href="/ai/setup/" className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-white/5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Configuracion IA
                </Link>
                <button onClick={() => logout()}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5 w-full">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Cerrar sesion
                </button>
              </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-6xl mx-auto p-8">
                {children}
              </div>
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
