"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type Message = { role: "user" | "ai"; text: string; ts: string };
type ClientData = { id: string; name: string; industry: string };

export default function AIChatPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(10);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/clients").then(r => r.json()).then(setClients).catch(() => {});
    const saved = localStorage.getItem("ai_chat_history");
    if (saved) { try { setMessages(JSON.parse(saved)); } catch {} }
  }, []);

  useEffect(() => {
    const qs = selectedClient ? `?client_id=${selectedClient}` : "";
    apiFetch(`/ai/suggestions${qs}`).then(r => r.json()).then(d => setSuggestions(d.suggestions || [])).catch(() => {});
  }, [selectedClient]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (messages.length) localStorage.setItem("ai_chat_history", JSON.stringify(messages.slice(-50))); }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { role: "user", text: text.trim(), ts: new Date().toLocaleTimeString("es-ES") }]);
    setInput("");
    setLoading(true);
    try {
      const res = await apiFetch("/ai/chat", { method: "POST", body: JSON.stringify({ message: text.trim(), client_id: selectedClient || null }) });
      const data = await res.json();
      if (data.remaining_requests !== undefined) setRemaining(data.remaining_requests);
      setMessages(prev => [...prev, { role: "ai", text: data.response || data.detail || "Sin respuesta", ts: new Date().toLocaleTimeString("es-ES") }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Error de conexion", ts: new Date().toLocaleTimeString("es-ES") }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>Asistente IA</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{remaining} consultas restantes</p>
        </div>
        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
          className="ml-auto rounded-xl px-4 py-2 text-sm" style={{ border: "1.5px solid var(--border)", background: "var(--bg-card)" }}>
          <option value="">Todos los clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Link href="/ai/setup/" className="text-xs px-3 py-2 rounded-lg transition-colors" style={{ color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          Configuracion
        </Link>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); localStorage.removeItem("ai_chat_history"); }}
            className="text-xs" style={{ color: "var(--text-muted)" }}>Limpiar</button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center py-12 animate-fade-up">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
              <svg className="w-8 h-8" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-lg mb-6" style={{ color: "var(--text-secondary)", fontFamily: "'DM Serif Display', serif" }}>Pregunta sobre tus clientes</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl mx-auto">
              {suggestions.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-left rounded-xl p-4 text-sm transition-all hover:shadow-md card-hover"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] px-5 py-3.5 ${m.role === "user" ? "chat-user" : "chat-ai"}`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px]" style={{ color: m.role === "user" ? "rgba(255,255,255,0.4)" : "var(--text-muted)" }}>{m.ts}</span>
                {m.role === "ai" && (
                  <button onClick={() => navigator.clipboard.writeText(m.text)} className="text-[10px] hover:underline" style={{ color: "var(--text-muted)" }}>Copiar</button>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="chat-ai px-5 py-4">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--text-muted)", animationDelay: `${i * 150}ms` }}></span>
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3 rounded-2xl p-2" style={{ background: "var(--bg-card)", border: "1.5px solid var(--border)", boxShadow: "0 4px 20px -4px rgba(0,0,0,0.06)" }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder={selectedClient ? `Pregunta sobre ${clients.find(c => c.id === selectedClient)?.name || "el cliente"}...` : "Escribe tu pregunta..."}
          className="flex-1 px-4 py-3 bg-transparent text-sm outline-none" style={{ color: "var(--text-primary)" }} disabled={loading} />
        <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-30"
          style={{ background: "var(--accent)" }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
        </button>
      </div>
    </div>
  );
}
