"use client";

import { useState } from "react";
import { apiFetch } from "../../lib/api";

type Message = { role: "user" | "ai"; text: string; timestamp: string };

const SUGGESTIONS = [
  "Analiza las metricas de La Terraza del ultimo mes",
  "Genera un resumen ejecutivo para ModaEco",
  "Que canal tiene mejor ROI para Sonrisa Plus?",
  "Sugiere mejoras para el dashboard de metricas",
];

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", text: text.trim(), timestamp: new Date().toLocaleTimeString("es-ES") };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await apiFetch("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message: text.trim() }),
      });
      const data = await res.json();
      const aiMsg: Message = {
        role: "ai",
        text: data.response || data.error || "Sin respuesta",
        timestamp: new Date().toLocaleTimeString("es-ES"),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Error de conexion", timestamp: new Date().toLocaleTimeString("es-ES") }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <h1 className="text-2xl font-bold mb-4">Asistente IA</h1>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-6">Pregunta lo que quieras sobre tus clientes y metricas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {SUGGESTIONS.map(s => (
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
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
              m.role === "user" ? "bg-blue-600 text-white" : "bg-white shadow border border-gray-100"
            }`}>
              <p className="text-sm whitespace-pre-wrap">{m.text}</p>
              <p className={`text-xs mt-1 ${m.role === "user" ? "text-blue-200" : "text-gray-400"}`}>{m.timestamp}</p>
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
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage(input)}
          placeholder="Escribe tu pregunta..."
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          disabled={loading}
        />
        <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          Enviar
        </button>
      </div>
    </div>
  );
}
