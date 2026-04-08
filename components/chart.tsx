"use client";

import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Area,
  AreaChart,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";

const THEME = {
  grid: "rgba(255,255,255,0.06)",
  text: "rgba(255,255,255,0.5)",
  green: "oklch(0.72 0.19 145)",
  red: "oklch(0.65 0.2 25)",
  blue: "oklch(0.65 0.18 250)",
  amber: "oklch(0.75 0.15 85)",
  cyan: "oklch(0.75 0.12 195)",
};

interface ChartProps {
  data: Record<string, unknown>[];
  height?: number;
}

export function PnlLineChart({ data, height = 300 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={THEME.green} stopOpacity={0.3} />
            <stop offset="95%" stopColor={THEME.green} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
        <XAxis
          dataKey="game_date"
          tick={{ fill: THEME.text, fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: THEME.text, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "oklch(0.16 0.005 260)",
            border: "1px solid oklch(0.28 0.005 260)",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="cumulative_pnl"
          stroke={THEME.green}
          fill="url(#pnlGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DailyPnlBarChart({ data, height = 200 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
        <XAxis
          dataKey="game_date"
          tick={{ fill: THEME.text, fontSize: 10 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: THEME.text, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "oklch(0.16 0.005 260)",
            border: "1px solid oklch(0.28 0.005 260)",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="daily_pnl">
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={
                (entry.daily_pnl as number) >= 0 ? THEME.green : THEME.red
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DrawdownChart({ data, height = 200 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={THEME.red} stopOpacity={0.3} />
            <stop offset="95%" stopColor={THEME.red} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
        <XAxis
          dataKey="game_date"
          tick={{ fill: THEME.text, fontSize: 10 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: THEME.text, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "oklch(0.16 0.005 260)",
            border: "1px solid oklch(0.28 0.005 260)",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="drawdown"
          stroke={THEME.red}
          fill="url(#ddGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ScatterPlot({
  data,
  xKey,
  yKey,
  height = 300,
}: ChartProps & { xKey: string; yKey: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
        <XAxis
          dataKey={xKey}
          type="number"
          tick={{ fill: THEME.text, fontSize: 11 }}
          name={xKey}
        />
        <YAxis
          dataKey={yKey}
          type="number"
          tick={{ fill: THEME.text, fontSize: 11 }}
          name={yKey}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "oklch(0.16 0.005 260)",
            border: "1px solid oklch(0.28 0.005 260)",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        />
        <Scatter data={data} fill={THEME.cyan} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export { THEME };
