"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";

type ProviderInfo = { name: string; installed: boolean; authenticated: boolean; version: string };
type SetupStatus = { default_provider: string; providers: Record<string, ProviderInfo> };

const PROVIDERS = {
  claude: { label: "Claude Code", cmd: "claude login", steps: [
    "Pulsa 'Abrir terminal' abajo",
    "En el terminal escribe: claude login",
    "Aparecera una URL -- copiala y abrela en tu navegador",
    "Autoriza con tu cuenta de Anthropic",
    "Cuando termine, pulsa 'Verificar' aqui",
  ]},
  codex: { label: "Codex (OpenAI)", cmd: "codex login", steps: [
    "Pulsa 'Abrir terminal' abajo",
    "En el terminal escribe: codex login",
    "Sigue las instrucciones que aparezcan",
    "Cuando termine, pulsa 'Verificar' aqui",
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
      if (data.authenticated) {
        setMessage({ text: `${PROVIDERS[provider].label} conectado correctamente!`, type: "success" });
      } else {
        setMessage({ text: "Aun no autenticado. Completa el login en el terminal.", type: "error" });
      }
      await loadStatus();
    } catch { setMessage({ text: "Error al verificar", type: "error" }); }
    finally { setVerifying(false); }
  };

  const setDefault = async (p: string) => {
    await apiFetch(`/ai/setup/default?provider=${p}`, { method: "POST" });
    await loadStatus();
    setMessage({ text: "Proveedor actualizado", type: "success" });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-gray-400">Cargando...</div></div>;

  const info = PROVIDERS[provider];
  const terminalUrl = `https://${typeof window !== "undefined" ? window.location.hostname : ""}:7681`;

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/ai/" className="text-blue-600 hover:underline text-sm">&larr; Chat IA</Link>
        <h1 className="text-2xl font-bold">Configuracion del Asistente IA</h1>
      </div>

      {message.text && (
        <div className={`rounded-lg p-3 mb-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left panel */}
        <div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">
          {/* Provider selector */}
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Proveedor</p>
            <div className="flex gap-2">
              {(["claude", "codex"] as const).map(p => {
                const pInfo = status?.providers[p];
                return (
                  <button key={p} onClick={() => setProvider(p)}
                    className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${provider === p ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    <div>{PROVIDERS[p].label}</div>
                    <div className={`text-xs mt-1 ${pInfo?.authenticated ? "text-green-600" : "text-gray-400"}`}>
                      {pInfo?.authenticated ? "Conectado" : pInfo?.installed ? "Sin conectar" : "No instalado"}
                    </div>
                  </button>
                );
              })}
            </div>
            {status?.default_provider && (
              <p className="text-xs text-gray-400 mt-2">Activo: {PROVIDERS[status.default_provider as "claude" | "codex"]?.label || status.default_provider}</p>
            )}
          </div>

          {/* Steps */}
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Pasos para conectar {info.label}</p>
            <ol className="space-y-2">
              {info.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-600">
                  <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 p-2 bg-gray-900 rounded text-green-400 font-mono text-xs">
              $ {info.cmd}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow p-4 space-y-2">
            <button onClick={() => setTerminalOpen(!terminalOpen)}
              className="w-full bg-gray-900 text-green-400 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800">
              {terminalOpen ? "Ocultar terminal" : "Abrir terminal"}
            </button>
            <button onClick={verify} disabled={verifying}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {verifying ? "Verificando..." : "Verificar autenticacion"}
            </button>
            {status?.providers[provider]?.authenticated && status.default_provider !== provider && (
              <button onClick={() => setDefault(provider)}
                className="w-full bg-blue-100 text-blue-700 py-2 rounded-lg text-sm hover:bg-blue-200">
                Usar como proveedor por defecto
              </button>
            )}
          </div>
        </div>

        {/* Right: Terminal (ttyd iframe) */}
        <div className="flex-1 bg-gray-900 rounded-xl overflow-hidden min-h-0">
          {terminalOpen ? (
            <iframe
              src={terminalUrl}
              className="w-full h-full border-0"
              title="Terminal del servidor"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">Terminal del servidor</p>
                <p className="text-sm">Pulsa "Abrir terminal" para empezar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
