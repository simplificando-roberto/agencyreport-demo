"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Metric = { channel: string; metric_name: string; value: number; date: string };

const COLORS: Record<string, string> = {
  instagram: "#E1306C", google_ads: "#4285F4", analytics: "#F4B400",
  facebook: "#1877F2", google_my_business: "#34A853",
};

export default function ClientDashboard() {
  const params = useParams();
  const clientId = params?.clientId as string;
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    if (!clientId) return;
    const url = `/api/clients/${clientId}/metrics?period=${period}` + (selectedChannel ? `&channel=${selectedChannel}` : "");
    fetch(url).then(r => r.json()).then(setMetrics);
  }, [clientId, period, selectedChannel]);

  // Group by metric name for charts
  const channels = [...new Set(metrics.map(m => m.channel))];
  const metricNames = [...new Set(metrics.map(m => m.metric_name))];

  // Build chart data: one series per metric_name
  const chartData = (metricName: string) => {
    const filtered = metrics.filter(m => m.metric_name === metricName);
    const byDate: Record<string, Record<string, number>> = {};
    for (const m of filtered) {
      const d = m.date.slice(0, 10);
      if (!byDate[d]) byDate[d] = { date: d } as any;
      (byDate[d] as any)[m.channel] = m.value;
    }
    return Object.values(byDate).sort((a, b) => ((a as any).date > (b as any).date ? 1 : -1));
  };

  // Latest value per metric+channel
  const latestValues: Record<string, { channel: string; value: number }[]> = {};
  for (const m of metrics) {
    if (!latestValues[m.metric_name]) latestValues[m.metric_name] = [];
  }
  for (const name of metricNames) {
    const group = metrics.filter(m => m.metric_name === name);
    const latest: Record<string, number> = {};
    for (const m of group) {
      latest[m.channel] = m.value;
    }
    latestValues[name] = Object.entries(latest).map(([ch, val]) => ({ channel: ch, value: Math.round(val * 100) / 100 }));
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Link href="/" className="text-blue-600 hover:underline text-sm">&larr; Volver al dashboard</Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">Metricas del cliente</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select value={period} onChange={e => setPeriod(+e.target.value)} className="border rounded-lg px-3 py-2">
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
          <option value={90}>90 dias</option>
        </select>
        <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} className="border rounded-lg px-3 py-2">
          <option value="">Todos los canales</option>
          {channels.map(ch => <option key={ch} value={ch}>{ch.replace("_", " ")}</option>)}
        </select>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {metricNames.slice(0, 8).map(name => (
          <div key={name} className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500 uppercase">{name.replace("_", " ")}</p>
            {latestValues[name]?.map(lv => (
              <p key={lv.channel} className="text-lg font-bold">
                {lv.value.toLocaleString("es-ES")} <span className="text-xs font-normal text-gray-400">{lv.channel}</span>
              </p>
            ))}
          </div>
        ))}
      </div>

      {/* Charts */}
      {metricNames.slice(0, 4).map(name => {
        const data = chartData(name);
        const seriesChannels = [...new Set(metrics.filter(m => m.metric_name === name).map(m => m.channel))];
        return (
          <div key={name} className="bg-white rounded-xl shadow p-6 mb-6">
            <h3 className="font-semibold mb-4 capitalize">{name.replace("_", " ")}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                {seriesChannels.map(ch => (
                  <Line key={ch} type="monotone" dataKey={ch} stroke={COLORS[ch] || "#888"} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
