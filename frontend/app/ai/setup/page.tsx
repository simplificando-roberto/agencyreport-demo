"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";

type ProviderInfo = { name: string; installed: boolean; authenticated: boolean; version: string };
type SetupStatus = { default_provider: string; providers: Record<string, ProviderInfo> };

const PROVIDERS: Record<string, { label: string; org: string; cmd: string; color: string }> = {
  claude: { label: "Claude Code", org: "Anthropic", cmd: "claude login", color: "#D97706" },
  codex: { label: "Codex", org: "OpenAI", cmd: "codex login", color: "#10B981" },
};

export default function AISetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalAuthed, setTerminalAuthed] = useState(false);
  const [termUser, setTermUser] = useState("");
  const [termPass, setTermPass] = useState("");
  const [termError, setTermError] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try { setStatus(await (await apiFetch("/ai/setup/status")).json()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const setDefault = async (p: string) => {
    await apiFetch(`/ai/setup/default?provider=${p}`, { method: "POST" });
    await loadStatus();
    setMessage({ text: "Proveedor actualizado", type: "success" });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}></div>
    </div>
  );

  const terminalUrl = `https://${typeof window !== "undefined" ? window.location.hostname : ""}:7682`;

  return (
    <>
      <div className="stagger">
        <div className="mb-8">
          <Link href="/ai/" className="text-xs mb-2 inline-block transition-colors" style={{ color: "var(--accent)" }}>&larr; Volver al chat</Link>
          <h1 className="text-3xl" style={{ color: "var(--text-primary)" }}>Configuracion IA</h1>
          <p style={{ color: "var(--text-secondary)" }}>Conecta tu proveedor de inteligencia artificial</p>
        </div>

        {message.text && (
          <div className="rounded-xl px-5 py-3.5 mb-6 text-sm animate-fade-up"
            style={{ background: message.type === "success" ? "#ECFDF5" : "#FEF2F2", color: message.type === "success" ? "var(--success)" : "var(--danger)" }}>
            {message.text}
          </div>
        )}

        {/* Provider status cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {status && Object.entries(status.providers).map(([key, info]) => {
            const p = PROVIDERS[key];
            const isDefault = status.default_provider === key;
            return (
              <div key={key} className="rounded-2xl p-6 relative"
                style={{ background: "var(--bg-card)", border: `2px solid ${isDefault ? p.color : "var(--border)"}`, boxShadow: isDefault ? `0 0 0 3px ${p.color}20` : "none" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs" style={{ background: p.color }}>
                      {key === "claude" ? "C" : "X"}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{p.label}</div>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{p.org}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDefault && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${p.color}15`, color: p.color }}>Activo</span>}
                    <span className={`w-2.5 h-2.5 rounded-full ${info.authenticated ? "animate-pulse" : ""}`} style={{ background: info.authenticated ? "var(--success)" : "var(--text-muted)" }}></span>
                  </div>
                </div>
                <div className="text-xs mb-4" style={{ color: info.authenticated ? "var(--success)" : "var(--text-muted)" }}>
                  {info.authenticated ? `Conectado - ${info.version}` : info.installed ? "Instalado, sin conectar" : "No instalado"}
                </div>
                {info.authenticated && !isDefault && (
                  <button onClick={() => setDefault(key)} className="text-xs px-3 py-1.5 rounded-lg transition-colors" style={{ background: `${p.color}10`, color: p.color }}>
                    Usar por defecto
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Terminal section */}
        <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-xl mb-2" style={{ color: "var(--text-primary)" }}>Terminal del servidor</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
            Usa el terminal para conectar o gestionar los proveedores de IA.
            El terminal tiene acceso al codigo de la aplicacion.
          </p>

          <div className="rounded-xl p-4 mb-5" style={{ background: "var(--bg-surface)" }}>
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Comandos disponibles</p>
            <div className="space-y-2">
              {Object.entries(PROVIDERS).map(([key, p]) => (
                <div key={key} className="flex items-center gap-3">
                  <code className="text-xs font-mono px-2 py-1 rounded" style={{ background: "var(--bg-deep)", color: "#A5F3FC" }}>{p.cmd}</code>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Conectar {p.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <code className="text-xs font-mono px-2 py-1 rounded" style={{ background: "var(--bg-deep)", color: "#A5F3FC" }}>claude &quot;mejora el dashboard&quot;</code>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Pedir a Claude que edite la app</span>
              </div>
            </div>
          </div>

          <button onClick={() => setTerminalOpen(true)}
            className="px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:shadow-lg inline-flex items-center gap-2"
            style={{ background: "var(--bg-deep)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" /></svg>
            Abrir terminal
          </button>

          <button onClick={loadStatus} className="ml-3 px-5 py-2.5 rounded-xl text-sm transition-colors"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            Actualizar estado
          </button>
        </div>
      </div>

      {/* Terminal Modal */}
      {terminalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) { setTerminalOpen(false); setTerminalAuthed(false); setTermError(""); } }}>
          <div className="w-full max-w-4xl h-[80vh] rounded-2xl overflow-hidden flex flex-col animate-fade-up" style={{ background: "var(--bg-deep)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <button onClick={() => { setTerminalOpen(false); setTerminalAuthed(false); setTermError(""); }} className="w-3 h-3 rounded-full hover:brightness-110" style={{ background: "#FF5F57" }}></button>
                  <div className="w-3 h-3 rounded-full" style={{ background: "#FEBC2E" }}></div>
                  <div className="w-3 h-3 rounded-full" style={{ background: "#28C840" }}></div>
                </div>
                <span className="text-xs text-gray-400 font-mono">Terminal &middot; ~/app</span>
              </div>
              <button onClick={() => { setTerminalOpen(false); setTerminalAuthed(false); setTermError(""); }} className="text-gray-500 hover:text-gray-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1">
              <iframe src={terminalUrl} className="w-full h-full border-0" title="Terminal" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
