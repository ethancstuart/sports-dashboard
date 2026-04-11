"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/metric-card";
import { DataTable, type Column } from "@/components/data-table";
import { fmtPct, fmtOdds, pnlColor } from "@/lib/format";

// ── Types ──

interface Pick {
  game_id: string;
  game_date: string;
  strategy: string;
  sport: string;
  side: string;
  edge: number | null;
  kelly_size: number | null;
  book_odds: number | null;
  model_prob: number | null;
  home_team_id: string;
  away_team_id: string;
  pnl: number | null;
  result: string | null;
}

interface Summary {
  total_picks: number;
  wins: number;
  losses: number;
  pushes: number;
  total_pnl: number;
  open_bets: number;
  last_sync: string | null;
}

// ── Table columns ──

const pickColumns: Column<Pick>[] = [
  {
    key: "game",
    header: "Game",
    render: (row) => (
      <span className="whitespace-nowrap">
        {row.away_team_id} @ {row.home_team_id}
      </span>
    ),
  },
  { key: "strategy", header: "Strategy" },
  {
    key: "side",
    header: "Side",
    render: (row) => (
      <span className="font-semibold">{row.side ?? "—"}</span>
    ),
  },
  {
    key: "edge",
    header: "Edge%",
    className: "text-right w-20",
    render: (row) =>
      row.edge != null ? (
        <span className={pnlColor(row.edge)}>{fmtPct(row.edge, 1)}</span>
      ) : (
        "—"
      ),
  },
  {
    key: "kelly_size",
    header: "Kelly Size",
    className: "text-right w-24",
    render: (row) =>
      row.kelly_size != null ? fmtPct(row.kelly_size, 2) : "—",
  },
  {
    key: "book_odds",
    header: "Book Odds",
    className: "text-right w-24",
    render: (row) => fmtOdds(row.book_odds),
  },
  {
    key: "model_prob",
    header: "Model",
    className: "text-right w-20",
    render: (row) =>
      row.model_prob != null ? fmtPct(row.model_prob, 1) : "—",
  },
];

// ── Helpers ──

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Page ──

export default function PositionsPage() {
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const today = todayISO();
        const [picksRes, summaryRes] = await Promise.all([
          fetch(`/api/picks?date=${today}`),
          fetch("/api/summary"),
        ]);

        if (!picksRes.ok || !summaryRes.ok) {
          throw new Error("API request failed");
        }

        const picksData: Pick[] = await picksRes.json();
        const summaryData: Summary = await summaryRes.json();

        // Sort by game_id so bets on the same game are grouped
        picksData.sort((a, b) => a.game_id.localeCompare(b.game_id));

        setPicks(picksData);
        setSummary(summaryData);
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

  // Derived exposure metrics
  const openBets = picks ? picks.filter((p) => p.result === null) : [];
  const totalExposure = openBets.reduce(
    (sum, p) => sum + (p.kelly_size ?? 0),
    0
  );
  const avgEdge =
    openBets.length > 0
      ? openBets.reduce((s, p) => s + (p.edge ?? 0), 0) / openBets.length
      : 0;

  // Exposure breakdown by sport
  const bySport = openBets.reduce<Record<string, { count: number; exposure: number }>>(
    (acc, p) => {
      const sport = p.sport ?? "Unknown";
      if (!acc[sport]) acc[sport] = { count: 0, exposure: 0 };
      acc[sport].count += 1;
      acc[sport].exposure += p.kelly_size ?? 0;
      return acc;
    },
    {}
  );

  // Exposure breakdown by strategy
  const byStrategy = openBets.reduce<Record<string, { count: number; exposure: number }>>(
    (acc, p) => {
      const strat = p.strategy ?? "Unknown";
      if (!acc[strat]) acc[strat] = { count: 0, exposure: 0 };
      acc[strat].count += 1;
      acc[strat].exposure += p.kelly_size ?? 0;
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        Open Positions
      </h1>

      {/* Top metrics */}
      {picks === null ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <MetricCard
            label="Open Bets"
            value={openBets.length.toString()}
            subtext={summary ? `${summary.open_bets} total pending` : undefined}
          />
          <MetricCard
            label="Total Exposure"
            value={fmtPct(totalExposure, 2)}
            subtext="Sum of Kelly sizes"
          />
          <MetricCard
            label="Avg Edge"
            value={fmtPct(avgEdge, 2)}
            className={pnlColor(avgEdge)}
          />
        </div>
      )}

      {/* Active Bets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Bets — {todayISO()}</CardTitle>
        </CardHeader>
        <CardContent>
          {picks === null ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={pickColumns}
              data={openBets as unknown as (Pick & Record<string, unknown>)[]}
              emptyMessage="No open positions today"
            />
          )}
        </CardContent>
      </Card>

      {/* Exposure Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Sport */}
        <Card>
          <CardHeader>
            <CardTitle>Exposure by Sport</CardTitle>
          </CardHeader>
          <CardContent>
            {picks === null ? (
              <Skeleton className="h-32 w-full" />
            ) : Object.keys(bySport).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open positions
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(bySport)
                  .sort(([, a], [, b]) => b.exposure - a.exposure)
                  .map(([sport, data]) => (
                    <div
                      key={sport}
                      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                    >
                      <div>
                        <span className="font-mono text-sm font-semibold uppercase">
                          {sport}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {data.count} bet{data.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className="font-mono text-sm">
                        {fmtPct(data.exposure, 2)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Strategy */}
        <Card>
          <CardHeader>
            <CardTitle>Exposure by Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            {picks === null ? (
              <Skeleton className="h-32 w-full" />
            ) : Object.keys(byStrategy).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open positions
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(byStrategy)
                  .sort(([, a], [, b]) => b.exposure - a.exposure)
                  .map(([strat, data]) => (
                    <div
                      key={strat}
                      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                    >
                      <div>
                        <span className="font-mono text-sm">{strat}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {data.count} bet{data.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className="font-mono text-sm">
                        {fmtPct(data.exposure, 2)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
