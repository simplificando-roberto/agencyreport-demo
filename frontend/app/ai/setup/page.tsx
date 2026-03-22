"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";

type ProviderInfo = { name: string; installed: boolean; authenticated: boolean; version: string };
type SetupStatus = { default_provider: string; providers: Record<string, ProviderInfo> };

const STEPS = {
  claude: [
    { label: "Ejecuta este comando en el terminal de la derecha:", cmd: "claude login" },
    { label: "Se abrira una URL -- copiala y abrela en tu navegador" },
    { label: "Autoriza con tu cuenta de Claude (Anthropic)" },
    { label: "Si te da un codigo, pegalo en el terminal" },
    { label: 'Cuando veas "Successfully logged in", pulsa "Verificar" abajo' },
  ],
  codex: [
    { label: "Ejecuta este comando en el terminal de la derecha:", cmd: "codex login" },
    { label: "Copia la URL que aparece y abrela en tu navegador" },
    { label: "Autoriza con tu cuenta de OpenAI" },
    { label: 'Cuando veas "Logged in", pulsa "Verificar" abajo' },
  ],
};

export default function AISetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<"claude" | "codex">("claude");
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const termRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try { setStatus(await (await apiFetch("/ai/setup/status")).json()); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadStatus(); }, []);

  // Initialize xterm + WebSocket
  useEffect(() => {
    if (!termRef.current) return;
    let term: any = null;
    let ws: WebSocket | null = null;

    const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement("script");
      s.src = src; s.onload = () => resolve(); s.onerror = reject;
      document.head.appendChild(s);
    });

    const init = async () => {
      // Load xterm.js from CDN (not available in Next.js standalone node_modules)
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css";
      document.head.appendChild(link);

      await loadScript("https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js");

      const Terminal = (window as any).Terminal;
      const FitAddon = (window as any).FitAddon;
      if (!Terminal) { console.error("xterm.js not loaded"); return; }

      term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        theme: { background: "#1a1b26", foreground: "#c0caf5", cursor: "#c0caf5" },
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termRef.current!);
      fitAddon.fit();
      termInstance.current = term;

      // Connect WebSocket
      // WebSocket connects directly to backend on port 9000 (bypasses nginx)
      ws = new WebSocket(`ws://${window.location.hostname}:9000/api/ai/terminal`);
      wsRef.current = ws;

      ws.onopen = () => {
        term.writeln("\x1b[36m=== Terminal del servidor ===\x1b[0m");
        term.writeln("\x1b[33mEscribe el comando de login del proveedor que quieras configurar.\x1b[0m");
        term.writeln("");
      };
      ws.onmessage = (e) => term.write(e.data);
      ws.onclose = () => term.writeln("\r\n\x1b[31m[Conexion cerrada]\x1b[0m");
      term.onData((data: string) => { if (ws?.readyState === 1) ws.send(data); });

      window.addEventListener("resize", () => fitAddon.fit());
    };

    init();
    return () => {
      ws?.close();
      term?.dispose();
    };
  }, []);

  const sendCommand = (cmd: string) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(cmd + "\n");
    }
  };

  const verify = async (provider: string) => {
    setVerifying(true);
    setMessage({ text: "", type: "" });
    try {
      const r = await apiFetch(`/ai/setup/verify?provider=${provider}`, { method: "POST" });
      const data = await r.json();
      if (data.authenticated) {
        setMessage({ text: `${provider === "claude" ? "Claude Code" : "Codex"} autenticado correctamente!`, type: "success" });
      } else {
        setMessage({ text: "Aun no autenticado. Completa el login en el terminal y vuelve a verificar.", type: "error" });
      }
      await loadStatus();
    } catch { setMessage({ text: "Error al verificar", type: "error" }); }
    finally { setVerifying(false); }
  };

  const setDefault = async (provider: string) => {
    await apiFetch(`/ai/setup/default?provider=${provider}`, { method: "POST" });
    await loadStatus();
    setMessage({ text: "Proveedor por defecto actualizado", type: "success" });
  };

  const logout = async (provider: string) => {
    if (provider === "claude") sendCommand("claude auth logout");
    await apiFetch(`/ai/setup/logout?provider=${provider}`, { method: "POST" });
    await loadStatus();
    setMessage({ text: "Sesion cerrada", type: "success" });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-gray-400">Cargando...</div></div>;

  const steps = STEPS[selectedProvider];

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/ai/" className="text-blue-600 hover:underline text-sm">&larr; Chat IA</Link>
        <h1 className="text-2xl font-bold">Configuracion del Asistente IA</h1>
      </div>

      {message.text && (
        <div className={`rounded-lg p-3 mb-4 text-sm ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left: Instructions */}
        <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto">
          {/* Provider selector */}
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Proveedor</p>
            <div className="flex gap-2">
              {(["claude", "codex"] as const).map(p => {
                const info = status?.providers[p];
                return (
                  <button key={p} onClick={() => setSelectedProvider(p)}
                    className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${selectedProvider === p ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    <div>{p === "claude" ? "Claude Code" : "Codex"}</div>
                    <div className={`text-xs mt-1 ${info?.authenticated ? "text-green-600" : "text-gray-400"}`}>
                      {info?.authenticated ? "Conectado" : info?.installed ? "Sin conectar" : "No instalado"}
                    </div>
                  </button>
                );
              })}
            </div>
            {status?.default_provider && (
              <p className="text-xs text-gray-400 mt-2">Por defecto: {status.default_provider === "claude" ? "Claude Code" : "Codex"}</p>
            )}
          </div>

          {/* Steps */}
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Pasos para conectar {selectedProvider === "claude" ? "Claude Code" : "Codex"}</p>
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                  <div>
                    <span className="text-gray-700">{s.label}</span>
                    {s.cmd && (
                      <button onClick={() => sendCommand(s.cmd!)}
                        className="mt-1 block bg-gray-900 text-green-400 px-3 py-1.5 rounded font-mono text-xs hover:bg-gray-800 cursor-pointer w-full text-left">
                        {s.cmd} <span className="text-gray-500 float-right">click para ejecutar</span>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow p-4 space-y-2">
            <button onClick={() => verify(selectedProvider)} disabled={verifying}
              className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {verifying ? "Verificando..." : "Verificar autenticacion"}
            </button>
            {status?.providers[selectedProvider]?.authenticated && (
              <>
                {status.default_provider !== selectedProvider && (
                  <button onClick={() => setDefault(selectedProvider)}
                    className="w-full bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-200">
                    Usar como proveedor por defecto
                  </button>
                )}
                <button onClick={() => logout(selectedProvider)}
                  className="w-full bg-red-50 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-100">
                  Desconectar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: Terminal */}
        <div className="flex-1 bg-[#1a1b26] rounded-xl overflow-hidden p-1 min-h-0">
          <div ref={termRef} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}
