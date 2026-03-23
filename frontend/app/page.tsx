"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API, checkAuth } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    checkAuth().then(ok => { if (ok) router.push("/dashboard/"); else setReady(true); });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }), credentials: "include",
      });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).detail || "Credenciales invalidas"); return; }
      const data = await res.json();
      localStorage.setItem("agency_name", data.agency_name);
      router.push("/dashboard/");
    } catch { setError("Error de conexion"); } finally { setLoading(false); }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: "var(--bg-deep)" }}>
      {/* Left: branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative noise-overlay">
        <div className="animate-fade-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: "var(--accent)" }}>AR</div>
            <span className="text-white/90 font-semibold tracking-tight">AgencyReport</span>
          </div>
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <h1 className="text-5xl text-white leading-tight mb-6" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Tus metricas.<br/>
            <span style={{ color: "var(--accent)" }}>Automatizadas.</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md leading-relaxed">
            Reportes profesionales con IA para tu agencia. Deja de perder horas en Excel.
          </p>
        </div>
        <div className="animate-fade-up text-gray-600 text-xs" style={{ animationDelay: "0.4s" }}>
          Dashboard de metricas &middot; Reportes PDF &middot; Asistente IA
        </div>
        {/* Decorative gradient orb */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: "var(--accent)" }}></div>
      </div>

      {/* Right: form */}
      <div className="flex-1 lg:max-w-lg flex items-center justify-center p-8 lg:p-16" style={{ background: "var(--bg-surface)" }}>
        <div className="w-full max-w-sm animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: "var(--accent)" }}>AR</div>
            <span className="font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>AgencyReport</span>
          </div>

          <h2 className="text-3xl mb-2" style={{ fontFamily: "'DM Serif Display', serif", color: "var(--text-primary)" }}>Bienvenido</h2>
          <p className="mb-8" style={{ color: "var(--text-secondary)" }}>Inicia sesion en tu cuenta</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm transition-all"
                style={{ border: "1.5px solid var(--border)", background: "var(--bg-card)" }}
                placeholder="tu@agencia.com" required autoComplete="email" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm transition-all"
                style={{ border: "1.5px solid var(--border)", background: "var(--bg-card)" }}
                placeholder="********" required autoComplete="current-password" />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "#FEF2F2", color: "var(--danger)" }}>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-medium text-sm transition-all hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50"
              style={{ background: "var(--accent)" }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                  Accediendo...
                </span>
              ) : "Iniciar sesion"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
