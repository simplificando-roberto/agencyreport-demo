"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type Message = { role: "user" | "ai"; text: string; ts: string };
type ClientData = { id: string; name: string; industry: string };

const HELP_ITEMS = [
  { icon: "1", text: "Selecciona un cliente arriba para dar contexto al asistente" },
  { icon: "2", text: "Pregunta sobre metricas, rendimiento, o pide resumenes" },
  { icon: "3", text: "Pide sugerencias de mejora para las campanas" },
  { icon: "4", text: "Genera resumenes ejecutivos para enviar a clientes" },
];

export default function AIChatPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(10);
  const [showHelp, setShowHelp] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/clients").then(r => r.json()).then(setClients).catch(() => {});
    // Load chat history from localStorage
    const saved = localStorage.getItem("ai_chat_history");
    if (saved) { try { setMessages(JSON.parse(saved)); } catch {} }
  }, []);

  useEffect(() => {
    // Load suggestions when client changes
    const qs = selectedClient ? `?client_id=${selectedClient}` : "";
    apiFetch(`/ai/suggestions${qs}`).then(r => r.json()).then(d => setSuggestions(d.suggestions || [])).catch(() => {});
  }, [selectedClient]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (messages.length) localStorage.setItem("ai_chat_history", JSON.stringify(messages.slice(-50))); }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", text: text.trim(), ts: new Date().toLocaleTimeString("es-ES") };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await apiFetch("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message: text.trim(), client_id: selectedClient || null }),
      });
      const data = await res.json();
      if (data.remaining_requests !== undefined) setRemaining(data.remaining_requests);
      setMessages(prev => [...prev, { role: "ai", text: data.response || data.detail || "Sin respuesta", ts: new Date().toLocaleTimeString("es-ES") }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Error de conexion", ts: new Date().toLocaleTimeString("es-ES") }]);
    } finally { setLoading(false); }
  };

  const clearChat = () => { setMessages([]); localStorage.removeItem("ai_chat_history"); };

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      {/* Main chat */}
      <div className="flex-1 flex flex-col">
        {/* Client selector */}
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl font-bold">Asistente IA</h1>
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Todos los clientes</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.industry})</option>)}
          </select>
          <span className="text-xs text-gray-400 ml-auto">{remaining} consultas restantes esta hora</span>
          <Link href="/ai/setup/" className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-200">Configuracion</Link>
          <button onClick={() => setShowHelp(!showHelp)} className="text-xs text-blue-500 hover:underline">Ayuda</button>
          {messages.length > 0 && <button onClick={clearChat} className="text-xs text-red-400 hover:text-red-600">Limpiar chat</button>}
        </div>

        {/* Help panel */}
        {showHelp && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <h3 className="font-semibold text-blue-800 mb-2">Como usar el asistente</h3>
            {HELP_ITEMS.map((h, i) => (
              <div key={i} className="flex gap-3 py-1 text-sm text-blue-700">
                <span className="bg-blue-200 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{h.icon}</span>
                <span>{h.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-lg mb-6">Pregunta lo que quieras sobre tus clientes</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {suggestions.map(s => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow transition-all text-sm text-gray-600">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-blue-600 text-white" : "bg-white shadow border border-gray-100"}`}>
                <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs ${m.role === "user" ? "text-blue-200" : "text-gray-400"}`}>{m.ts}</span>
                  {m.role === "ai" && (
                    <button onClick={() => navigator.clipboard.writeText(m.text)} className="text-xs text-gray-400 hover:text-gray-600">Copiar</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white shadow border border-gray-100 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="flex gap-3">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder={selectedClient ? `Pregunta sobre ${clients.find(c => c.id === selectedClient)?.name || "el cliente"}...` : "Selecciona un cliente o pregunta algo general..."}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" disabled={loading} />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
