"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/metric-card";
import {
  PnlLineChart,
  DailyPnlBarChart,
  DrawdownChart,
} from "@/components/chart";
import { DataTable, type Column } from "@/components/data-table";
import { fmtCurrency, fmtPct, pnlColor } from "@/lib/format";

// ── Types ──

interface PnlRow {
  game_date: string;
  daily_pnl: number;
  cumulative_pnl: number;
  bets: number;
  wins: number;
}

interface StrategyRow {
  strategy: string;
  sport: string;
  total: number;
  wins: number;
  losses: number;
  total_pnl: number;
  avg_clv: number | null;
  avg_edge: number | null;
}

// ── Drawdown computation ──

function computeDrawdown(
  data: PnlRow[]
): { game_date: string; drawdown: number }[] {
  let peak = -Infinity;
  return data.map((d) => {
    if (d.cumulative_pnl > peak) peak = d.cumulative_pnl;
    return {
      game_date: d.game_date,
      drawdown: d.cumulative_pnl - peak,
    };
  });
}

// ── Strategy table columns ──

const strategyColumns: Column<StrategyRow>[] = [
  { key: "strategy", header: "Strategy" },
  { key: "sport", header: "Sport", className: "w-20" },
  {
    key: "total",
    header: "Bets",
    className: "text-right w-16",
    render: (row) => row.total,
  },
  {
    key: "record",
    header: "W-L",
    className: "text-right w-20",
    render: (row) => `${row.wins}-${row.losses}`,
  },
  {
    key: "win_pct",
    header: "Win%",
    className: "text-right w-20",
    render: (row) =>
      row.total > 0 ? fmtPct(row.wins / row.total, 1) : "—",
  },
  {
    key: "roi",
    header: "ROI%",
    className: "text-right w-20",
    render: (row) =>
      row.total > 0 ? fmtPct(row.total_pnl / row.total, 1) : "—",
  },
  {
    key: "total_pnl",
    header: "P&L",
    className: "text-right w-24",
    render: (row) => (
      <span className={pnlColor(row.total_pnl)}>
        {fmtCurrency(row.total_pnl)}
      </span>
    ),
  },
  {
    key: "avg_clv",
    header: "Avg CLV",
    className: "text-right w-24",
    render: (row) =>
      row.avg_clv != null ? fmtPct(row.avg_clv, 2) : "—",
  },
];

// ── Page ──

export default function PnlPage() {
  const [pnlData, setPnlData] = useState<PnlRow[] | null>(null);
  const [strategies, setStrategies] = useState<StrategyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [pnlRes, stratRes] = await Promise.all([
          fetch("/api/pnl?days=90"),
          fetch("/api/strategies"),
        ]);

        if (!pnlRes.ok || !stratRes.ok) {
          throw new Error("API request failed");
        }

        const pnl: PnlRow[] = await pnlRes.json();
        const strat: StrategyRow[] = await stratRes.json();

        // P&L data comes DESC from API — reverse for chronological charts
        setPnlData([...pnl].reverse());
        // Strategies already sorted by total_pnl DESC from API
        setStrategies(strat);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center p-12 text-destructive">
        {error}
      </div>
    );
  }

  // Derived metrics
  const totalPnl = pnlData
    ? pnlData[pnlData.length - 1]?.cumulative_pnl ?? 0
    : 0;
  const totalBets = strategies
    ? strategies.reduce((s, r) => s + r.total, 0)
    : 0;
  const totalWins = strategies
    ? strategies.reduce((s, r) => s + r.wins, 0)
    : 0;
  const drawdownData = pnlData ? computeDrawdown(pnlData) : [];
  const maxDrawdown = drawdownData.length
    ? Math.min(...drawdownData.map((d) => d.drawdown))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        P&L Tracker
      </h1>

      {/* Top metrics */}
      {pnlData === null ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard
            label="Total P&L"
            value={fmtCurrency(totalPnl)}
            className={pnlColor(totalPnl)}
          />
          <MetricCard
            label="Total Bets"
            value={totalBets.toLocaleString()}
          />
          <MetricCard
            label="Win Rate"
            value={totalBets > 0 ? fmtPct(totalWins / totalBets) : "—"}
          />
          <MetricCard
            label="Max Drawdown"
            value={fmtCurrency(maxDrawdown)}
            className={pnlColor(maxDrawdown)}
          />
        </div>
      )}

      {/* Cumulative P&L chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cumulative P&L (90 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {pnlData === null ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <PnlLineChart data={pnlData as unknown as Record<string, unknown>[]} />
          )}
        </CardContent>
      </Card>

      {/* Daily P&L + Drawdown side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily P&L</CardTitle>
          </CardHeader>
          <CardContent>
            {pnlData === null ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <DailyPnlBarChart
                data={pnlData as unknown as Record<string, unknown>[]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drawdown</CardTitle>
          </CardHeader>
          <CardContent>
            {pnlData === null ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <DrawdownChart
                data={drawdownData as unknown as Record<string, unknown>[]}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Strategy Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {strategies === null ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={strategyColumns}
              data={strategies as unknown as (StrategyRow & Record<string, unknown>)[]}
              emptyMessage="No strategy data available"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
