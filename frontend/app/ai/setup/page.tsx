"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";

type ProviderInfo = {
  name: string;
  installed: boolean;
  authenticated: boolean;
  version: string;
  login_method: string;
  token_url?: string;
  token_help?: string;
};

type SetupStatus = {
  default_provider: string;
  providers: Record<string, ProviderInfo>;
};

export default function AISetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenInputs, setTokenInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });

  const loadStatus = async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/ai/setup/status");
      setStatus(await r.json());
    } catch { setMessage({ text: "Error al cargar estado", type: "error" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStatus(); }, []);

  const submitToken = async (provider: string) => {
    const token = tokenInputs[provider]?.trim();
    if (!token) return;
    setSubmitting(provider);
    setMessage({ text: "", type: "" });
    try {
      const r = await apiFetch(`/ai/setup/login?provider=${provider}`, {
        method: "POST", body: JSON.stringify({ token }),
      });
      const data = await r.json();
      if (data.authenticated) {
        setMessage({ text: `${provider === "claude" ? "Claude Code" : "Codex"} autenticado correctamente!`, type: "success" });
        setTokenInputs(prev => ({ ...prev, [provider]: "" }));
      } else {
        setMessage({ text: data.message || "Token no valido", type: "error" });
      }
      await loadStatus();
    } catch { setMessage({ text: "Error de conexion", type: "error" }); }
    finally { setSubmitting(""); }
  };

  const setDefault = async (provider: string) => {
    await apiFetch(`/ai/setup/default?provider=${provider}`, { method: "POST" });
    await loadStatus();
    setMessage({ text: `${provider === "claude" ? "Claude Code" : "Codex"} configurado como proveedor por defecto`, type: "success" });
  };

  const logout = async (provider: string) => {
    await apiFetch(`/ai/setup/logout?provider=${provider}`, { method: "POST" });
    await loadStatus();
    setMessage({ text: "Sesion cerrada", type: "success" });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-gray-400">Cargando configuracion...</div></div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/ai/" className="text-blue-600 hover:underline text-sm">&larr; Volver al chat</Link>
        <h1 className="text-2xl font-bold">Configuracion del Asistente IA</h1>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">Como funciona</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Elige un proveedor: <b>Claude Code</b> (Anthropic) o <b>Codex</b> (OpenAI)</li>
          <li>Genera un token en la pagina del proveedor (link mas abajo)</li>
          <li>Pega el token aqui y pulsa "Conectar"</li>
          <li>Listo! El asistente usara ese proveedor para responder</li>
        </ol>
        <p className="text-xs text-blue-500 mt-2">El token se guarda en el servidor. Puedes cerrar sesion cuando quieras y el token se elimina.</p>
      </div>

      {/* Messages */}
      {message.text && (
        <div className={`rounded-xl p-4 mb-6 text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* Provider cards */}
      <div className="space-y-4">
        {status && Object.entries(status.providers).map(([key, p]) => (
          <div key={key} className={`bg-white rounded-xl shadow p-6 border-2 transition-colors ${status.default_provider === key ? "border-blue-500" : "border-transparent"}`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  {status.default_provider === key && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">Por defecto</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{p.login_method}</p>
              </div>
              <div className="flex items-center gap-2">
                {p.installed ? (
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">{p.version}</span>
                ) : (
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">No instalado</span>
                )}
                {p.authenticated ? (
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">Conectado</span>
                ) : (
                  <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">Sin conectar</span>
                )}
              </div>
            </div>

            {/* Token input (when not authenticated) */}
            {p.installed && !p.authenticated && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm text-gray-700 font-medium">Paso 1:</p>
                  {p.token_url && (
                    <a href={p.token_url} target="_blank" rel="noopener noreferrer"
                      className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">
                      Obtener token de {p.name}
                    </a>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">{p.token_help}</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={tokenInputs[key] || ""}
                    onChange={e => setTokenInputs(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder="Pega tu token aqui..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={() => submitToken(key)}
                    disabled={!tokenInputs[key]?.trim() || submitting === key}
                    className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting === key ? "Conectando..." : "Conectar"}
                  </button>
                </div>
              </div>
            )}

            {/* Actions when authenticated */}
            {p.authenticated && (
              <div className="flex gap-2 mt-2">
                {status.default_provider !== key && (
                  <button onClick={() => setDefault(key)}
                    className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-200">
                    Usar como proveedor por defecto
                  </button>
                )}
                <button onClick={() => logout(key)}
                  className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100">
                  Desconectar
                </button>
              </div>
            )}

            {!p.installed && (
              <p className="text-sm text-gray-400 mt-2">Este proveedor no esta instalado en el servidor.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
