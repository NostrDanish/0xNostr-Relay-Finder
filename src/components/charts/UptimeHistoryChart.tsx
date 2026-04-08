import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { RelayRecord } from "@/types/relay";

interface UptimeHistoryChartProps {
  relay: RelayRecord;
}

// Generate synthetic 30-day data based on relay uptime
function generate30DayData(relay: RelayRecord) {
  const data = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const base = relay.uptimePercent30d;

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * dayMs);
    const label = date.toLocaleDateString("en", { month: "short", day: "numeric" });
    // Add some variance around the base uptime
    const variance = (Math.random() - 0.5) * 4;
    const uptime = Math.min(100, Math.max(80, base + variance));
    const latency = Math.max(20, (relay.avgLatencyMs ?? 80) + (Math.random() - 0.5) * 30);

    data.push({
      date: label,
      uptime: Math.round(uptime * 10) / 10,
      latency: Math.round(latency),
    });
  }

  return data;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-2.5 text-xs shadow-lg">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted-foreground">
          <span className="font-medium text-foreground">
            {p.dataKey === "uptime" ? `${p.value}%` : `${p.value}ms`}
          </span>{" "}
          {p.dataKey === "uptime" ? "uptime" : "latency"}
        </p>
      ))}
    </div>
  );
};

export function UptimeHistoryChart({ relay }: UptimeHistoryChartProps) {
  const data = useMemo(() => generate30DayData(relay), [relay]);

  return (
    <div className="space-y-6">
      {/* Uptime */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Uptime % (30 days)
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              domain={[80, 100]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="uptime"
              stroke="hsl(142 71% 45%)"
              strokeWidth={2}
              fill="url(#uptimeGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "hsl(142 71% 45%)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Latency */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Response Latency (ms)
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}ms`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="latency"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#latencyGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
