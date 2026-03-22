"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ClientData = { id: string; name: string; industry: string; channels: Record<string, boolean>; created_at: string };
type Overview = { total_clients: number; active_alerts: number; total_metrics_today: number; clients: ClientData[] };

const API = "/api";

export default function Home() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/dashboard/overview`).then(r => r.json()).then(setOverview).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen"><p className="text-lg">Cargando...</p></div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-blue-600">AgencyReport</h1>
        <p className="text-gray-500 mt-1">Reporting automatizado para tu agencia</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wide">Clientes</p>
          <p className="text-4xl font-bold mt-2">{overview?.total_clients ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wide">Alertas activas</p>
          <p className="text-4xl font-bold mt-2 text-amber-500">{overview?.active_alerts ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wide">Metricas hoy</p>
          <p className="text-4xl font-bold mt-2 text-green-600">{overview?.total_metrics_today ?? 0}</p>
        </div>
      </div>

      {/* Client List */}
      <h2 className="text-xl font-semibold mb-4">Clientes</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {overview?.clients.map(c => (
          <Link key={c.id} href={`/dashboard/${c.id}`} className="block bg-white rounded-xl shadow hover:shadow-lg transition-shadow p-6">
            <h3 className="text-lg font-bold">{c.name}</h3>
            <p className="text-sm text-gray-500">{c.industry}</p>
            <div className="flex gap-2 mt-3">
              {Object.keys(c.channels).map(ch => (
                <span key={ch} className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">{ch.replace("_", " ")}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-8 flex gap-4">
        <Link href="/reports" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
          Ver Reportes
        </Link>
      </div>
    </div>
  );
}
