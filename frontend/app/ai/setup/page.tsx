"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";

type ProviderInfo = { name: string; installed: boolean; authenticated: boolean; version: string };
type SetupStatus = { default_provider: string; providers: Record<string, ProviderInfo> };

const PROVIDERS = {
  claude: { label: "Claude Code", org: "Anthropic", cmd: "claude login", color: "#D97706", steps: [
    "Escribe: claude login",
    "Aparecera una URL -- copiala y abrela en tu navegador",
    "Autoriza con tu cuenta de Anthropic",
    "Si te da un codigo, pegalo en el terminal",
    "Cuando termine, cierra el terminal y pulsa Verificar",
  ]},
  codex: { label: "Codex", org: "OpenAI", cmd: "codex login", color: "#10B981", steps: [
    "Escribe: codex login",
    "Sigue las instrucciones que aparezcan",
    "Autoriza con tu cuenta de OpenAI",
    "Cuando termine, cierra el terminal y pulsa Verificar",
  ]},
};

export default function AISetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<"claude" | "codex">("claude");
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [terminalOpen, setTerminalOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try { setStatus(await (await apiFetch("/ai/setup/status")).json()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const verify = async () => {
    setVerifying(true);
    setMessage({ text: "", type: "" });
    try {
      const r = await apiFetch(`/ai/setup/verify?provider=${provider}`, { method: "POST" });
      const data = await r.json();
      setMessage({
        text: data.authenticated ? `${PROVIDERS[provider].label} conectado correctamente!` : "Aun no autenticado. Completa el login en el terminal.",
        type: data.authenticated ? "success" : "error",
      });
      await loadStatus();
    } catch { setMessage({ text: "Error al verificar", type: "error" }); }
    finally { setVerifying(false); }
  };

  const setDefault = async (p: string) => {
    await apiFetch(`/ai/setup/default?provider=${p}`, { method: "POST" });
    await loadStatus();
    setMessage({ text: "Proveedor actualizado", type: "success" });
  };

  const doLogout = async (p: string) => {
    await apiFetch(`/ai/setup/logout?provider=${p}`, { method: "POST" });
    await loadStatus();
    setMessage({ text: "Desconectado", type: "success" });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}></div>
    </div>
  );

  const terminalUrl = `https://${typeof window !== "undefined" ? window.location.hostname : ""}:7681`;

  return (
    <>
      <div className="stagger">
        {/* Header */}
        <div className="mb-8">
          <Link href="/ai/" className="text-xs mb-2 inline-block transition-colors" style={{ color: "var(--accent)" }}>&larr; Volver al chat</Link>
          <h1 className="text-3xl" style={{ color: "var(--text-primary)" }}>Configuracion IA</h1>
          <p style={{ color: "var(--text-secondary)" }}>Conecta tu proveedor de inteligencia artificial</p>
        </div>

        {/* Message */}
        {message.text && (
          <div className="rounded-xl px-5 py-3.5 mb-6 text-sm flex items-center gap-2 animate-fade-up"
            style={{ background: message.type === "success" ? "#ECFDF5" : "#FEF2F2", color: message.type === "success" ? "var(--success)" : "var(--danger)", border: `1px solid ${message.type === "success" ? "#A7F3D0" : "#FECACA"}` }}>
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={message.type === "success" ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
            </svg>
            {message.text}
          </div>
        )}

        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {(["claude", "codex"] as const).map(key => {
            const p = PROVIDERS[key];
            const info = status?.providers[key];
            const isDefault = status?.default_provider === key;
            const isSelected = provider === key;

            return (
              <button key={key} onClick={() => setProvider(key)}
                className="text-left rounded-2xl p-6 transition-all card-hover relative overflow-hidden"
                style={{
                  background: "var(--bg-card)",
                  border: `2px solid ${isSelected ? p.color : "var(--border)"}`,
                  boxShadow: isSelected ? `0 0 0 3px ${p.color}20` : "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                {/* Status badge */}
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
                    {isDefault && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${p.color}15`, color: p.color }}>Activo</span>
                    )}
                    {info?.authenticated ? (
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--success)" }}></span>
                    ) : info?.installed ? (
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--text-muted)" }}></span>
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--danger)" }}></span>
                    )}
                  </div>
                </div>

                <div className="text-xs" style={{ color: info?.authenticated ? "var(--success)" : "var(--text-muted)" }}>
                  {info?.authenticated ? `Conectado - ${info.version}` : info?.installed ? "Instalado, sin conectar" : "No instalado"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions for selected provider */}
        <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-xl mb-4" style={{ color: "var(--text-primary)" }}>
            {PROVIDERS[provider].label}
          </h2>

          {/* Steps */}
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Pasos para conectar</p>
            <ol className="space-y-2.5">
              {PROVIDERS[provider].steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white" style={{ background: PROVIDERS[provider].color }}>{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Command preview */}
          <div className="rounded-xl p-4 mb-6 font-mono text-sm flex items-center justify-between" style={{ background: "var(--bg-deep)", color: "#A5F3FC" }}>
            <span>$ {PROVIDERS[provider].cmd}</span>
            <button onClick={() => navigator.clipboard.writeText(PROVIDERS[provider].cmd)} className="text-xs text-gray-500 hover:text-gray-300">Copiar</button>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => setTerminalOpen(true)}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:shadow-lg"
              style={{ background: "var(--bg-deep)" }}>
              Abrir terminal
            </button>
            <button onClick={verify} disabled={verifying}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: "var(--success)" }}>
              {verifying ? "Verificando..." : "Verificar autenticacion"}
            </button>
            {status?.providers[provider]?.authenticated && status.default_provider !== provider && (
              <button onClick={() => setDefault(provider)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                Usar por defecto
              </button>
            )}
            {status?.providers[provider]?.authenticated && (
              <button onClick={() => doLogout(provider)}
                className="px-5 py-2.5 rounded-xl text-sm transition-colors"
                style={{ color: "var(--danger)" }}>
                Desconectar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Terminal Modal */}
      {terminalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-4xl h-[80vh] rounded-2xl overflow-hidden flex flex-col animate-fade-up" style={{ background: "var(--bg-deep)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <button onClick={() => setTerminalOpen(false)} className="w-3 h-3 rounded-full hover:brightness-110" style={{ background: "#FF5F57" }}></button>
                  <div className="w-3 h-3 rounded-full" style={{ background: "#FEBC2E" }}></div>
                  <div className="w-3 h-3 rounded-full" style={{ background: "#28C840" }}></div>
                </div>
                <span className="text-xs text-gray-400 font-mono">Terminal del servidor</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-500">
                  Usuario: <span className="text-gray-400">admin</span> &middot; Se pedira contraseña al conectar
                </span>
                <button onClick={() => setTerminalOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            {/* iframe */}
            <div className="flex-1">
              <iframe src={terminalUrl} className="w-full h-full border-0" title="Terminal" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
