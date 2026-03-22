"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ClientData = { id: string; name: string; industry: string; channels: Record<string, boolean> };
type ReportData = { id: string; title: string; period_start: string; period_end: string; ai_summary: string | null; channels: string[]; created_at: string };

export default function ReportsPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [period, setPeriod] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [latestReport, setLatestReport] = useState<ReportData | null>(null);

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(setClients);
    fetch("/api/reports").then(r => r.json()).then(setReports);
  }, []);

  const generateReport = async () => {
    if (!selectedClient) return;
    setGenerating(true);
    setLatestReport(null);
    try {
      const resp = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedClient, period_days: period }),
      });
      const report = await resp.json();
      setLatestReport(report);
      setReports(prev => [report, ...prev]);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link href="/" className="text-blue-600 hover:underline text-sm">&larr; Dashboard</Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">Generador de Reportes</h1>

      {/* Generator */}
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="font-semibold mb-4">Generar nuevo reporte</h2>
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Cliente</label>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="border rounded-lg px-3 py-2 w-48">
              <option value="">Seleccionar...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Periodo</label>
            <select value={period} onChange={e => setPeriod(+e.target.value)} className="border rounded-lg px-3 py-2">
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
            </select>
          </div>
          <button
            onClick={generateReport}
            disabled={!selectedClient || generating}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {generating ? "Generando..." : "Generar Reporte"}
          </button>
        </div>
      </div>

      {/* Latest generated report */}
      {latestReport && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
          <h3 className="font-bold text-green-800 mb-2">{latestReport.title}</h3>
          <p className="text-sm text-gray-500 mb-3">
            {new Date(latestReport.period_start).toLocaleDateString("es-ES")} - {new Date(latestReport.period_end).toLocaleDateString("es-ES")}
          </p>
          <div className="flex gap-2 mb-3">
            {latestReport.channels.map(ch => (
              <span key={ch} className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">{ch}</span>
            ))}
          </div>
          {latestReport.ai_summary && (
            <div className="bg-white rounded-lg p-4 mt-3">
              <p className="text-sm font-medium text-gray-700 mb-1">Resumen IA:</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{latestReport.ai_summary}</p>
            </div>
          )}
        </div>
      )}

      {/* Report history */}
      <h2 className="font-semibold mb-4">Reportes anteriores</h2>
      {reports.length === 0 ? (
        <p className="text-gray-400">Sin reportes aun. Genera el primero arriba.</p>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString("es-ES")}</p>
              </div>
              <div className="flex gap-2">
                {r.channels.map(ch => (
                  <span key={ch} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{ch}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
