"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type ClientData = { id: string; name: string; industry: string; channels: Record<string, boolean> };
type AlertInfo = { client: string; channel: string; metric: string; threshold: number };
type Overview = { total_clients: number; active_alerts: number; total_metrics_today: number; clients: ClientData[]; recent_alerts: AlertInfo[] };

const CHANNEL_COLORS: Record<string, string> = {
  instagram: "#E1306C", google_ads: "#4285F4", analytics: "#F4B400",
  facebook: "#1877F2", google_my_business: "#34A853",
};

export default function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/dashboard/overview").then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}></div>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando dashboard...</span>
      </div>
    </div>
  );

  return (
    <div className="stagger">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl mb-1" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
        <p style={{ color: "var(--text-secondary)" }}>Vista general de tu agencia</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {[
          { label: "Clientes", value: data?.total_clients ?? 0, color: "var(--info)", bg: "#EFF6FF" },
          { label: "Alertas activas", value: data?.active_alerts ?? 0, color: (data?.active_alerts ?? 0) > 0 ? "var(--danger)" : "var(--success)", bg: (data?.active_alerts ?? 0) > 0 ? "#FEF2F2" : "#ECFDF5" },
          { label: "Metricas hoy", value: data?.total_metrics_today ?? 0, color: "var(--accent)", bg: "var(--accent-soft)" },
        ].map(kpi => (
          <div key={kpi.label} className="relative rounded-2xl p-6 kpi-accent card-hover" style={{ background: "var(--bg-card)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>{kpi.label}</p>
            <p className="text-4xl font-light" style={{ color: kpi.color, fontFamily: "'DM Serif Display', serif" }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {(data?.recent_alerts?.length ?? 0) > 0 && (
        <div className="rounded-2xl p-5 mb-8" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--danger)" }}></div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--danger)" }}>Alertas recientes</h3>
          </div>
          {data!.recent_alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 text-sm" style={{ color: "#991B1B" }}>
              <span className="font-medium">{a.client}</span>
              <span style={{ color: "#DC2626" }}>&middot;</span>
              <span>{a.metric} ({a.channel}) bajo {a.threshold}</span>
            </div>
          ))}
        </div>
      )}

      {/* Clients */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl" style={{ color: "var(--text-primary)" }}>Clientes</h2>
        <span className="text-xs px-3 py-1 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          {data?.total_clients ?? 0} activos
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {data?.clients.map(c => (
          <Link key={c.id} href={`/dashboard/${c.id}/`}
            className="block rounded-2xl p-6 card-hover group" style={{ background: "var(--bg-card)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold group-hover:text-orange-600 transition-colors" style={{ fontFamily: "'DM Serif Display', serif" }}>{c.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.industry}</p>
              </div>
              <svg className="w-5 h-5 text-gray-300 group-hover:text-orange-500 transition-all group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(c.channels).map(ch => (
                <span key={ch} className="text-[11px] px-2.5 py-1 rounded-full font-medium text-white"
                  style={{ background: CHANNEL_COLORS[ch] || "#888" }}>
                  {ch.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
