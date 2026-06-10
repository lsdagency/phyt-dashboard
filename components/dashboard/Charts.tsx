"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardData, SeriesPoint } from "@/lib/integrations/types";

const INK = "#002E29";
const BLUE = "#99DAEF";
const GREEN = "#4ECC7C";
const PINK = "#F6B0C6";
const YELLOW = "#F7E04A";

const shortDate = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-phyt-ink/10 bg-white p-4">
      <h3 className="text-base">{title}</h3>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const axisProps = {
  stroke: INK,
  tick: { fontSize: 11, fill: INK, opacity: 0.6 },
  tickLine: false,
  axisLine: false,
};

export default function Charts({ data }: { data: DashboardData }) {
  const ts = data.asa.timeseries;

  const ttrSeries = ts.map((p) => ({
    date: p.date,
    ttr:
      Math.round(
        ((p.taps as number) / Math.max(p.impressions as number, 1)) * 1000,
      ) / 10,
  }));

  const cpiSeries = ts.map((p) => ({
    date: p.date,
    cpi:
      Math.round(((p.spend as number) / Math.max(p.installs as number, 1)) * 100) /
      100,
  }));

  const convSeries = data.dailyConversions as SeriesPoint[];

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <ChartCard title="TTR by day (%)">
        <LineChart data={ttrSeries} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={INK} opacity={0.08} />
          <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip labelFormatter={(l) => shortDate(String(l))} />
          <Line type="monotone" dataKey="ttr" stroke={BLUE} strokeWidth={3} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title={`Cost per install by day (${data.currency})`}>
        <LineChart data={cpiSeries} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={INK} opacity={0.08} />
          <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip labelFormatter={(l) => shortDate(String(l))} />
          <Line type="monotone" dataKey="cpi" stroke={YELLOW} strokeWidth={3} dot={false} />
        </LineChart>
      </ChartCard>

      <ChartCard title="Trials & subscriptions by day">
        <AreaChart data={convSeries} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={INK} opacity={0.08} />
          <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip labelFormatter={(l) => shortDate(String(l))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="trials" stroke={GREEN} fill={GREEN} fillOpacity={0.25} strokeWidth={2} />
          <Area type="monotone" dataKey="subs" stroke={PINK} fill={PINK} fillOpacity={0.35} strokeWidth={2} />
        </AreaChart>
      </ChartCard>
    </div>
  );
}
