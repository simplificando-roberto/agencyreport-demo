"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, API } from "../../lib/api";

type ClientData = { id: string; name: string };
type ReportData = { id: string; title: string; period_start: string; period_end: string; ai_summary: string | null; channels: string[]; created_at: string };

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [selectedClient, setSelectedClient] = useState(searchParams?.get("client") || "");
  const [period, setPeriod] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [latestReport, setLatestReport] = useState<ReportData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch("/clients").then(r => r.json()).then(setClients).catch(() => {});
    apiFetch("/reports").then(r => r.json()).then(setReports).catch(() => {});
  }, []);

  const generateReport = async () => {
    if (!selectedClient) return;
    setGenerating(true); setLatestReport(null);
    try {
      const resp = await apiFetch("/reports/generate", { method: "POST", body: JSON.stringify({ client_id: selectedClient, period_days: period }) });
      const report = await resp.json();
      setLatestReport(report);
      setReports(prev => [report, ...prev]);
    } finally { setGenerating(false); }
  };

  const downloadExcel = (reportId: string) => {
    const token = localStorage.getItem("token") || "";
    window.open(`${API}/reports/${reportId}/excel?token=${token}`, "_blank");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClient) return;
    setUploading(true); setUploadResult("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const token = localStorage.getItem("token") || "";
      const resp = await fetch(`${API}/data/upload?client_id=${selectedClient}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const data = await resp.json();
      setUploadResult(`${data.rows_imported} filas importadas correctamente`);
    } catch { setUploadResult("Error al importar el archivo"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reportes</h1>

      {/* Generator */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold mb-4">Generar nuevo reporte</h2>
        <div className="flex gap-4 items-end flex-wrap">
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
          <button onClick={generateReport} disabled={!selectedClient || generating}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {generating ? "Generando..." : "Generar Reporte"}
          </button>
        </div>
      </div>

      {/* Upload Excel */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold mb-2">Importar datos desde Excel/CSV</h2>
        <p className="text-sm text-gray-500 mb-4">Columnas esperadas: fecha, canal, metrica, valor</p>
        <div className="flex gap-4 items-center">
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="border rounded-lg px-3 py-2 w-48">
            <option value="">Seleccionar cliente...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className={`cursor-pointer px-4 py-2 rounded-lg border-2 border-dashed transition-colors text-sm ${selectedClient ? "border-blue-300 text-blue-600 hover:bg-blue-50" : "border-gray-200 text-gray-400"}`}>
            {uploading ? "Importando..." : "Subir archivo Excel o CSV"}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} disabled={!selectedClient || uploading} className="hidden" />
          </label>
        </div>
        {uploadResult && <p className={`mt-3 text-sm ${uploadResult.includes("Error") ? "text-red-500" : "text-green-600"}`}>{uploadResult}</p>}
      </div>

      {/* Latest report */}
      {latestReport && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-green-800">{latestReport.title}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(latestReport.period_start).toLocaleDateString("es-ES")} - {new Date(latestReport.period_end).toLocaleDateString("es-ES")}
              </p>
            </div>
            <button onClick={() => downloadExcel(latestReport.id)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
              Descargar Excel
            </button>
          </div>
          <div className="flex gap-2 mt-3">{latestReport.channels.map(ch => (
            <span key={ch} className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">{ch}</span>
          ))}</div>
          {latestReport.ai_summary && (
            <div className="bg-white rounded-lg p-4 mt-3">
              <p className="text-sm font-medium text-gray-700 mb-1">Resumen IA:</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{latestReport.ai_summary}</p>
            </div>
          )}
        </div>
      )}

      {/* Report list */}
      <h2 className="font-semibold mb-4">Reportes anteriores</h2>
      {reports.length === 0 ? <p className="text-gray-400">Sin reportes aun. Genera el primero arriba.</p> : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString("es-ES")}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">{r.channels.map(ch => (
                  <span key={ch} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{ch}</span>
                ))}</div>
                <button onClick={() => downloadExcel(r.id)} className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-200">Excel</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
