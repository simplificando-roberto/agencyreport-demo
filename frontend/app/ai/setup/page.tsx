"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";

type ProviderInfo = { name: string; installed: boolean; authenticated: boolean; version: string };
type SetupStatus = { default_provider: string; providers: Record<string, ProviderInfo> };

const STEPS = {
  claude: { cmd: "claude login", steps: [
    "Pulsa el boton de abajo para ejecutar el login",
    "Se mostrara una URL en el terminal -- copiala y abrela en tu navegador",
    "Autoriza con tu cuenta de Anthropic (Claude)",
    "Si te da un codigo, pegalo en el campo de input del terminal",
    "Cuando termine, pulsa 'Verificar' para confirmar",
  ]},
  codex: { cmd: "codex login", steps: [
    "Pulsa el boton de abajo para ejecutar el login",
    "Copia la URL que aparece y abrela en tu navegador",
    "Autoriza con tu cuenta de OpenAI",
    "Cuando termine, pulsa 'Verificar' para confirmar",
  ]},
};

export default function AISetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<"claude" | "codex">("claude");
  const [sessionId, setSessionId] = useState("");
  const [termOutput, setTermOutput] = useState("");
  const [termInput, setTermInput] = useState("");
  const [running, setRunning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const termRef = useRef<HTMLPreElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try { setStatus(await (await apiFetch("/ai/setup/status")).json()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [termOutput]);

  // Polling for terminal output
  useEffect(() => {
    if (!sessionId || !running) return;
    const poll = async () => {
      try {
        const r = await apiFetch(`/ai/terminal/read?session_id=${sessionId}`);
        const data = await r.json();
        if (data.output) setTermOutput(prev => prev + data.output);
        if (!data.alive) { setRunning(false); setTermOutput(prev => prev + "\n[Proceso terminado]\n"); }
      } catch {}
    };
    pollingRef.current = setInterval(poll, 500);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [sessionId, running]);

  const startLogin = async () => {
    setTermOutput("");
    setMessage({ text: "", type: "" });
    const cmd = STEPS[provider].cmd;
    setTermOutput(`$ ${cmd}\n`);
    try {
      const r = await apiFetch(`/ai/terminal/start?command=${encodeURIComponent(cmd)}`, { method: "POST" });
      const data = await r.json();
      setSessionId(data.session_id);
      setRunning(true);
    } catch { setTermOutput(prev => prev + "[Error al iniciar]\n"); }
  };

  const sendInput = async () => {
    if (!termInput.trim() || !sessionId) return;
    const text = termInput + "\n";
    setTermOutput(prev => prev + text);
    setTermInput("");
    await apiFetch(`/ai/terminal/write?session_id=${sessionId}`, {
      method: "POST", body: JSON.stringify({ text }),
    });
  };

  const verify = async () => {
    setVerifying(true);
    setMessage({ text: "", type: "" });
    try {
      const r = await apiFetch(`/ai/setup/verify?provider=${provider}`, { method: "POST" });
      const data = await r.json();
      if (data.authenticated) {
        setMessage({ text: `${provider === "claude" ? "Claude Code" : "Codex"} conectado!`, type: "success" });
      } else {
        setMessage({ text: "Aun no autenticado. Completa el login en el terminal.", type: "error" });
      }
      await loadStatus();
    } catch { setMessage({ text: "Error", type: "error" }); }
    finally { setVerifying(false); }
  };

  const setDefault = async (p: string) => {
    await apiFetch(`/ai/setup/default?provider=${p}`, { method: "POST" });
    await loadStatus();
    setMessage({ text: "Proveedor actualizado", type: "success" });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-gray-400">Cargando...</div></div>;

  const steps = STEPS[provider];

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
                const info = status?.providers[p];
                return (
                  <button key={p} onClick={() => setProvider(p)}
                    className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${provider === p ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    <div>{p === "claude" ? "Claude" : "Codex"}</div>
                    <div className={`text-xs mt-1 ${info?.authenticated ? "text-green-600" : "text-gray-400"}`}>
                      {info?.authenticated ? "Conectado" : info?.installed ? "Sin conectar" : "No instalado"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Steps */}
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Pasos</p>
            <ol className="space-y-2">
              {steps.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-600">
                  <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow p-4 space-y-2">
            <button onClick={startLogin} disabled={running}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {running ? "Ejecutando..." : `Ejecutar: ${steps.cmd}`}
            </button>
            <button onClick={verify} disabled={verifying}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {verifying ? "Verificando..." : "Verificar autenticacion"}
            </button>
            {status?.providers[provider]?.authenticated && status.default_provider !== provider && (
              <button onClick={() => setDefault(provider)}
                className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200">
                Usar como proveedor por defecto
              </button>
            )}
          </div>
        </div>

        {/* Right: Terminal */}
        <div className="flex-1 flex flex-col bg-[#1a1b26] rounded-xl overflow-hidden min-h-0">
          <pre ref={termRef} className="flex-1 overflow-y-auto p-4 text-sm font-mono text-green-400 whitespace-pre-wrap">
            {termOutput || "Terminal listo. Pulsa el boton de login para empezar.\n"}
          </pre>
          <div className="flex border-t border-gray-700">
            <span className="text-green-500 px-3 py-2 font-mono text-sm">$</span>
            <input value={termInput} onChange={e => setTermInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendInput()}
              placeholder={running ? "Escribe aqui si te pide algo..." : ""}
              disabled={!running}
              className="flex-1 bg-transparent text-green-400 font-mono text-sm py-2 outline-none placeholder-gray-600" />
            <button onClick={sendInput} disabled={!running || !termInput.trim()}
              className="text-green-500 px-3 py-2 text-sm hover:text-green-300 disabled:text-gray-600">
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
