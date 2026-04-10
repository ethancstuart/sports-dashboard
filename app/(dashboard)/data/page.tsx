"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */

interface TableStat {
  table: string;
  count: number;
}

interface SportFreshness {
  sport: string;
  latest_game: string | null;
  total_games: number;
  completed: number;
}

interface DataStats {
  stats: TableStat[];
  freshness: SportFreshness[];
}

/* ---------- helpers ---------- */

function freshnessColor(days: number | null): string {
  if (days == null) return "text-muted-foreground";
  if (days <= 1) return "text-[var(--win)]";
  if (days <= 3) return "text-[var(--paused)]";
  return "text-[var(--loss)]";
}

function freshnessLabel(days: number | null): string {
  if (days == null) return "No data";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function fmtNumber(n: number): string {
  return n.toLocaleString("en-US");
}

const EXPECTED_TABLES = [
  "games",
  "strategy_picks",
  "predictions",
  "subgame_predictions",
  "elo_ratings",
  "odds",
  "nfl_quarter_scores",
  "nba_quarter_scores",
];

/* ---------- skeleton ---------- */

function DataSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-3 w-24" />
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-3 w-16" />
              <Skeleton className="h-6 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function DataObservatoryPage() {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/data/stats");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStats(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    }
    load();
  }, []);

  const totalRows =
    stats?.stats.reduce((sum, t) => sum + t.count, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-mono text-xl font-bold tracking-tight">
          DATA OBSERVATORY
        </h1>
        <p className="text-sm text-muted-foreground">
          Table statistics &middot; Data freshness
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-[var(--loss)]/30 bg-[var(--loss)]/10 px-4 py-2 text-sm text-[var(--loss)]">
          Failed to load data stats: {error}
        </div>
      )}

      {stats === null && !error ? (
        <DataSkeleton />
      ) : stats ? (
        <>
          {/* Total rows summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard
              label="Total Rows"
              value={fmtNumber(totalRows)}
              subtext={`Across ${stats.stats.length} tables`}
            />
            <MetricCard
              label="Tables Tracked"
              value={String(stats.stats.length)}
              subtext={
                stats.stats.length === EXPECTED_TABLES.length
                  ? "All present"
                  : `${EXPECTED_TABLES.length - stats.stats.length} missing`
              }
            />
          </div>

          {/* Table Stats Grid */}
          <section className="space-y-3">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Table Row Counts
            </h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-xs uppercase">
                      Table
                    </TableHead>
                    <TableHead className="font-mono text-xs uppercase text-right">
                      Rows
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.stats.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-muted-foreground"
                      >
                        No table data
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.stats
                      .sort((a, b) => b.count - a.count)
                      .map((t) => (
                        <TableRow key={t.table}>
                          <TableCell className="font-mono text-sm">
                            {t.table}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-right">
                            {fmtNumber(t.count)}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Data Freshness by Sport */}
          <section className="space-y-3">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Data Freshness by Sport
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {stats.freshness.map((f) => {
                const daysStale = f.latest_game
                  ? Math.floor(
                      (Date.now() - new Date(f.latest_game + "T00:00:00").getTime()) /
                        86400000
                    )
                  : null;
                return (
                  <Card key={f.sport}>
                    <CardHeader className="pb-0">
                      <CardTitle className="font-mono text-sm">
                        {f.sport.toUpperCase()}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Latest Game
                          </span>
                          <span className="font-mono">
                            {f.latest_game ?? "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Freshness
                          </span>
                          <span
                            className={cn(
                              "font-mono font-semibold",
                              freshnessColor(daysStale)
                            )}
                          >
                            {freshnessLabel(daysStale)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Games
                          </span>
                          <span className="font-mono">
                            {fmtNumber(f.completed)}/{fmtNumber(f.total_games)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {stats.freshness.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No freshness data available
                </p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
