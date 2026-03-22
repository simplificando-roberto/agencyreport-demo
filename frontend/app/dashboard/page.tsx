"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type ClientData = { id: string; name: string; industry: string; channels: Record<string, boolean> };
type AlertInfo = { client: string; channel: string; metric: string; threshold: number };
type Overview = { total_clients: number; active_alerts: number; total_metrics_today: number; clients: ClientData[]; recent_alerts: AlertInfo[] };

export default function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/dashboard/overview").then(r => r.json()).then(setOverview).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-gray-400">Cargando dashboard...</div></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wide">Clientes</p>
          <p className="text-4xl font-bold mt-2">{overview?.total_clients ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wide">Alertas activas</p>
          <p className={`text-4xl font-bold mt-2 ${(overview?.active_alerts ?? 0) > 0 ? "text-red-500" : "text-green-500"}`}>
            {overview?.active_alerts ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wide">Metricas hoy</p>
          <p className="text-4xl font-bold mt-2 text-blue-600">{overview?.total_metrics_today ?? 0}</p>
        </div>
      </div>

      {/* Recent Alerts */}
      {(overview?.recent_alerts?.length ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
          <h3 className="font-semibold text-red-800 mb-2">Alertas recientes</h3>
          {overview!.recent_alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-red-700 py-1">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span className="font-medium">{a.client}</span> - {a.metric} ({a.channel}) por debajo de {a.threshold}
            </div>
          ))}
        </div>
      )}

      {/* Client Cards */}
      <h2 className="text-xl font-semibold mb-4">Clientes</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {overview?.clients.map(c => (
          <div key={c.id} className="bg-white rounded-xl shadow hover:shadow-lg transition-shadow p-6">
            <Link href={`/dashboard/${c.id}/`} className="block">
              <h3 className="text-lg font-bold">{c.name}</h3>
              <p className="text-sm text-gray-500">{c.industry}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                {Object.keys(c.channels).map(ch => (
                  <span key={ch} className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">{ch.replace(/_/g, " ")}</span>
                ))}
              </div>
            </Link>
            <div className="mt-4 flex gap-2">
              <Link href={`/dashboard/${c.id}/`} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-200">Ver metricas</Link>
              <Link href={`/reports/?client=${c.id}`} className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-200">Generar reporte</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
