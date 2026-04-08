"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/metric-card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUnits, fmtPct, fmtCurrency, fmtOdds, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */

interface Summary {
  total_pnl: number;
  roi: number;
  win_rate: number;
  open_bets: number;
  total_bets: number;
  bankroll: number;
}

interface Pick {
  strategy: string;
  sport: string;
  side: string;
  edge: number;
  kelly: number;
  book_odds: number;
  model: string;
  [key: string]: unknown;
}

interface Result {
  strategy: string;
  sport: string;
  side: string;
  result: string;
  pnl: number;
  clv: number;
  [key: string]: unknown;
}

interface Strategy {
  name: string;
  sport: string;
  win_rate: number;
  backtest_win_rate: number;
  total_picks: number;
  pnl: number;
  [key: string]: unknown;
}

/* ---------- helpers ---------- */

function today(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function deriveStatus(s: Strategy): string {
  if (s.win_rate >= s.backtest_win_rate) return "LIVE";
  return "MONITOR";
}

const BANKROLL_BASE = 200;

/* ---------- column defs ---------- */

const pickColumns: Column<Pick>[] = [
  { key: "strategy", header: "Strategy" },
  { key: "sport", header: "Sport" },
  { key: "side", header: "Side" },
  {
    key: "edge",
    header: "Edge%",
    render: (r) => fmtPct(r.edge),
  },
  {
    key: "kelly",
    header: "Kelly%",
    render: (r) => fmtPct(r.kelly),
  },
  {
    key: "book_odds",
    header: "Book Odds",
    render: (r) => fmtOdds(r.book_odds),
  },
  { key: "model", header: "Model" },
];

const resultColumns: Column<Result>[] = [
  { key: "strategy", header: "Strategy" },
  { key: "sport", header: "Sport" },
  { key: "side", header: "Side" },
  {
    key: "result",
    header: "Result",
    render: (r) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
          r.result === "win"
            ? "bg-[var(--win)]/20 text-[var(--win)]"
            : "bg-[var(--loss)]/20 text-[var(--loss)]"
        )}
      >
        {r.result.toUpperCase()}
      </span>
    ),
  },
  {
    key: "pnl",
    header: "P&L",
    render: (r) => (
      <span className={pnlColor(r.pnl)}>{fmtUnits(r.pnl)}</span>
    ),
  },
  {
    key: "clv",
    header: "CLV",
    render: (r) => fmtPct(r.clv),
  },
];

/* ---------- skeleton loaders ---------- */

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="mb-2 h-3 w-16" />
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 14 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="mb-1 h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

export default function CommandCenter() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [strategies, setStrategies] = useState<Strategy[] | null>(null);

  useEffect(() => {
    async function load() {
      const [sumRes, picksRes, resultsRes, stratRes] = await Promise.all([
        fetch("/api/summary"),
        fetch(`/api/picks?date=${today()}`),
        fetch(`/api/results?date=${yesterday()}`),
        fetch("/api/strategies"),
      ]);
      const [sumData, picksData, resultsData, stratData] = await Promise.all([
        sumRes.json(),
        picksRes.json(),
        resultsRes.json(),
        stratRes.json(),
      ]);
      setSummary(sumData);
      setPicks(picksData);
      setResults(resultsData);
      setStrategies(stratData);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-mono text-xl font-bold tracking-tight">
          COMMAND CENTER
        </h1>
        <p className="text-sm text-muted-foreground">
          Portfolio overview &middot; {today()}
        </p>
      </div>

      {/* Top row: 6 metric cards */}
      {!summary ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            label="Total P&L"
            value={fmtUnits(summary.total_pnl)}
            className={pnlColor(summary.total_pnl)}
          />
          <MetricCard
            label="ROI"
            value={fmtPct(summary.roi)}
            className={pnlColor(summary.roi)}
          />
          <MetricCard
            label="Win Rate"
            value={fmtPct(summary.win_rate)}
          />
          <MetricCard
            label="Open Bets"
            value={String(summary.open_bets)}
          />
          <MetricCard
            label="Total Bets"
            value={String(summary.total_bets)}
          />
          <MetricCard
            label="Bankroll"
            value={fmtCurrency(summary.bankroll ?? BANKROLL_BASE)}
            subtext={`Base: ${fmtCurrency(BANKROLL_BASE)}`}
          />
        </div>
      )}

      {/* Today's Picks */}
      <section className="space-y-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Picks &middot; {today()}
        </h2>
        {picks === null ? (
          <TableSkeleton />
        ) : (
          <DataTable<Pick>
            columns={pickColumns}
            data={picks}
            emptyMessage="No picks today"
          />
        )}
      </section>

      {/* Yesterday's Results */}
      <section className="space-y-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Yesterday&apos;s Results &middot; {yesterday()}
        </h2>
        {results === null ? (
          <TableSkeleton />
        ) : (
          <DataTable<Result>
            columns={resultColumns}
            data={results}
            emptyMessage="No results yesterday"
          />
        )}
      </section>

      {/* Strategy Status Grid */}
      <section className="space-y-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Strategy Status
        </h2>
        {strategies === null ? (
          <GridSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {strategies.map((s) => {
              const status = deriveStatus(s);
              return (
                <Card key={s.name}>
                  <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="truncate font-mono text-sm">
                        {s.name}
                      </CardTitle>
                      <StatusBadge status={status} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <span className="mr-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                      {s.sport}
                    </span>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Win%</div>
                        <div className="font-mono font-semibold">
                          {fmtPct(s.win_rate)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Picks</div>
                        <div className="font-mono font-semibold">
                          {s.total_picks}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">P&L</div>
                        <div
                          className={cn(
                            "font-mono font-semibold",
                            pnlColor(s.pnl)
                          )}
                        >
                          {fmtUnits(s.pnl)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
