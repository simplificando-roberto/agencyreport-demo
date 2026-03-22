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
};

type SetupStatus = {
  default_provider: string;
  providers: Record<string, ProviderInfo>;
};

type LoginResult = {
  login_url: string;
  device_code: string;
  needs_code_input: boolean;
  instructions: string;
  raw_output: string;
};

export default function AISetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginResult, setLoginResult] = useState<LoginResult | null>(null);
  const [loginProvider, setLoginProvider] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [oauthCode, setOauthCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/ai/setup/status");
      setStatus(await r.json());
    } catch { setMessage("Error al cargar estado"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStatus(); }, []);

  const startLogin = async (provider: string) => {
    setLoggingIn(true);
    setLoginProvider(provider);
    setLoginResult(null);
    setMessage("");
    try {
      const r = await apiFetch(`/ai/setup/login?provider=${provider}`, { method: "POST" });
      const data = await r.json();
      setLoginResult(data);
    } catch { setMessage("Error al iniciar login"); }
    finally { setLoggingIn(false); }
  };

  const verify = async (provider: string) => {
    setVerifying(true);
    setMessage("");
    try {
      const r = await apiFetch(`/ai/setup/verify?provider=${provider}`, { method: "POST" });
      const data = await r.json();
      if (data.authenticated) {
        setMessage(`${provider} autenticado correctamente!`);
        setLoginResult(null);
      } else {
        setMessage("Aun no autenticado. Completa el login en tu navegador y vuelve a verificar.");
      }
      await loadStatus();
    } catch { setMessage("Error al verificar"); }
    finally { setVerifying(false); }
  };

  const sendCode = async (provider: string) => {
    if (!oauthCode.trim()) return;
    setSendingCode(true);
    setMessage("");
    try {
      const r = await apiFetch(`/ai/setup/code?provider=${provider}`, {
        method: "POST", body: JSON.stringify({ code: oauthCode.trim() }),
      });
      const data = await r.json();
      if (data.authenticated) {
        setMessage("Autenticado correctamente!");
        setLoginResult(null);
        setOauthCode("");
      } else {
        setMessage(data.message || "Codigo no valido. Intenta de nuevo.");
      }
      await loadStatus();
    } catch { setMessage("Error al enviar codigo"); }
    finally { setSendingCode(false); }
  };

  const setDefault = async (provider: string) => {
    await apiFetch(`/ai/setup/default?provider=${provider}`, { method: "POST" });
    await loadStatus();
    setMessage(`${provider} configurado como proveedor por defecto`);
  };

  const logout = async (provider: string) => {
    await apiFetch(`/ai/setup/logout?provider=${provider}`, { method: "POST" });
    await loadStatus();
    setMessage(`Sesion de ${provider} cerrada`);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-gray-400">Cargando configuracion...</div></div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/ai/" className="text-blue-600 hover:underline text-sm">&larr; Volver al chat</Link>
        <h1 className="text-2xl font-bold">Configuracion del Asistente IA</h1>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">Como funciona</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Elige un proveedor de IA: Claude Code (Anthropic) o Codex (OpenAI)</li>
          <li>Pulsa "Iniciar sesion" -- se abrira una URL para autorizar con tu cuenta</li>
          <li>Una vez autorizado, vuelve aqui y pulsa "Verificar"</li>
          <li>El proveedor autenticado se usara para el chat IA</li>
        </ol>
        <p className="text-xs text-blue-500 mt-2">Tus credenciales se guardan en el servidor. Puedes cerrar sesion cuando quieras.</p>
      </div>

      {message && (
        <div className={`rounded-xl p-4 mb-6 text-sm ${message.includes("correctamente") || message.includes("defecto") ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
          {message}
        </div>
      )}

      {/* Provider cards */}
      <div className="space-y-4">
        {status && Object.entries(status.providers).map(([key, p]) => (
          <div key={key} className={`bg-white rounded-xl shadow p-6 border-2 ${status.default_provider === key ? "border-blue-500" : "border-transparent"}`}>
            <div className="flex justify-between items-start">
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
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Instalado {p.version}</span>
                ) : (
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">No instalado</span>
                )}
                {p.authenticated ? (
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Autenticado</span>
                ) : (
                  <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">Sin sesion</span>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              {p.installed && !p.authenticated && (
                <button onClick={() => startLogin(key)} disabled={loggingIn}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {loggingIn && loginProvider === key ? "Iniciando..." : "Iniciar sesion"}
                </button>
              )}
              {p.authenticated && status.default_provider !== key && (
                <button onClick={() => setDefault(key)}
                  className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-200">
                  Usar por defecto
                </button>
              )}
              {p.authenticated && (
                <button onClick={() => logout(key)}
                  className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100">
                  Cerrar sesion
                </button>
              )}
              {!p.installed && (
                <p className="text-sm text-gray-400">Este proveedor no esta instalado en el servidor.</p>
              )}
            </div>

            {/* Login flow */}
            {loginResult && loginProvider === key && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-medium text-amber-800 mb-3">Completa el login:</p>

                {/* Step 1: Open URL */}
                {loginResult.login_url && (
                  <div className="mb-4">
                    <p className="text-sm text-amber-700 mb-2 font-medium">Paso 1: Abre esta URL en tu navegador</p>
                    <a href={loginResult.login_url} target="_blank" rel="noopener noreferrer"
                      className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                      Abrir pagina de autorizacion
                    </a>
                  </div>
                )}

                {/* Step 2: Paste code (Claude OAuth) */}
                {loginResult.needs_code_input && (
                  <div className="mb-4">
                    <p className="text-sm text-amber-700 mb-2 font-medium">Paso 2: Pega el codigo que te da la pagina</p>
                    <div className="flex gap-2">
                      <input value={oauthCode} onChange={e => setOauthCode(e.target.value)}
                        placeholder="Pega aqui el codigo..."
                        className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
                      <button onClick={() => sendCode(key)} disabled={sendingCode || !oauthCode.trim()}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                        {sendingCode ? "Enviando..." : "Enviar codigo"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Device code (Codex) */}
                {loginResult.device_code && (
                  <div className="mb-4">
                    <p className="text-sm text-amber-700 mb-1">Introduce este codigo en la pagina:</p>
                    <code className="bg-white px-3 py-2 rounded text-lg font-mono font-bold">{loginResult.device_code}</code>
                  </div>
                )}

                {/* Fallback: raw output */}
                {!loginResult.login_url && !loginResult.device_code && loginResult.raw_output && (
                  <pre className="bg-white rounded p-3 text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">{loginResult.raw_output}</pre>
                )}

                {/* Verify button (for flows without code input) */}
                {!loginResult.needs_code_input && (
                  <button onClick={() => verify(key)} disabled={verifying}
                    className="mt-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {verifying ? "Verificando..." : "Verificar autenticacion"}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
