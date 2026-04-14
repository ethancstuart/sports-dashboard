"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface IngestionEntry {
  sport: string;
  source: string;
  data_type: string;
  records_fetched: number;
  records_stored: number;
  status: string;
  created_at: string;
}

interface SettlementLag {
  sport: string;
  avg_hours: number;
  max_hours: number;
  settled_count: number;
}

interface ModelHealth {
  name: string;
  sport: string;
  data: string;
  created_at: string;
}

interface AlertEntry {
  severity: string;
  message: string;
  details: string;
  created_at: string;
}

interface GovernanceData {
  ingestion_log: IngestionEntry[];
  settlement_lag: SettlementLag[];
  model_health: ModelHealth[];
  unsettled_count: number;
  alerts: AlertEntry[];
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

function severityBadge(severity: string) {
  switch (severity?.toLowerCase()) {
    case "error":
      return "bg-[var(--loss)]/20 text-[var(--loss)] border-[var(--loss)]/30";
    case "warning":
      return "bg-[var(--paused)]/20 text-[var(--paused)] border-[var(--paused)]/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function DataObservatoryPage() {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [governance, setGovernance] = useState<GovernanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, govRes] = await Promise.all([
          fetch("/api/data/stats"),
          fetch("/api/data/governance"),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        else throw new Error(`HTTP ${statsRes.status}`);
        if (govRes.ok) setGovernance(await govRes.json());
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
          Table statistics &middot; Data freshness &middot; Pipeline governance
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

          {/* ── Governance Sections ── */}
          {governance && (
            <>
              {/* Model Health Summary */}
              {governance.model_health.length > 0 && (
                <section className="space-y-3">
                  <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Model Health (Recent Retrains)
                  </h2>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono text-xs uppercase">Date</TableHead>
                          <TableHead className="font-mono text-xs uppercase">Status</TableHead>
                          <TableHead className="font-mono text-xs uppercase text-right">Brier</TableHead>
                          <TableHead className="font-mono text-xs uppercase text-right">Cal Slope</TableHead>
                          <TableHead className="font-mono text-xs uppercase text-right">Accuracy</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {governance.model_health.map((m, i) => {
                          let parsed: Record<string, unknown> = {};
                          try { parsed = JSON.parse(m.data); } catch { /* ignore */ }
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-sm">{(parsed.date as string) ?? m.created_at?.slice(0, 10)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn(
                                  "text-[10px]",
                                  parsed.promoted ? "text-[var(--win)]" : "text-[var(--loss)]"
                                )}>
                                  {parsed.promoted ? "PROMOTED" : "REJECTED"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm text-right">
                                {typeof parsed.brier === "number" ? (parsed.brier as number).toFixed(4) : "—"}
                              </TableCell>
                              <TableCell className="font-mono text-sm text-right">
                                {typeof parsed.calibration_slope === "number" ? (parsed.calibration_slope as number).toFixed(3) : "—"}
                              </TableCell>
                              <TableCell className="font-mono text-sm text-right">
                                {typeof parsed.accuracy === "number" ? `${((parsed.accuracy as number) * 100).toFixed(1)}%` : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

              {/* Settlement Lag + Unsettled */}
              <section className="space-y-3">
                <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Settlement Health
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <MetricCard
                    label="Unsettled (>24h)"
                    value={String(governance.unsettled_count)}
                    subtext={governance.unsettled_count === 0 ? "All clear" : "Needs attention"}
                  />
                  {governance.settlement_lag.map((s) => (
                    <Card key={s.sport}>
                      <CardContent className="pt-4 pb-3">
                        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                          {s.sport.toUpperCase()} Avg Lag
                        </div>
                        <div className="mt-1 font-mono text-lg font-bold">
                          {s.avg_hours?.toFixed(1) ?? "—"}h
                        </div>
                        <div className="text-xs text-muted-foreground">
                          max {s.max_hours?.toFixed(1) ?? "—"}h &middot; {s.settled_count} settled
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Pipeline Execution Log */}
              {governance.ingestion_log.length > 0 && (
                <section className="space-y-3">
                  <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Pipeline Execution Log
                  </h2>
                  <div className="rounded-md border max-h-80 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono text-xs uppercase">Time</TableHead>
                          <TableHead className="font-mono text-xs uppercase">Sport</TableHead>
                          <TableHead className="font-mono text-xs uppercase">Source</TableHead>
                          <TableHead className="font-mono text-xs uppercase">Type</TableHead>
                          <TableHead className="font-mono text-xs uppercase text-right">Fetched</TableHead>
                          <TableHead className="font-mono text-xs uppercase text-right">Stored</TableHead>
                          <TableHead className="font-mono text-xs uppercase">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {governance.ingestion_log.map((entry, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{entry.created_at?.slice(0, 16) ?? "—"}</TableCell>
                            <TableCell className="font-mono text-xs uppercase">{entry.sport}</TableCell>
                            <TableCell className="font-mono text-xs">{entry.source}</TableCell>
                            <TableCell className="font-mono text-xs">{entry.data_type}</TableCell>
                            <TableCell className="font-mono text-xs text-right">{entry.records_fetched?.toLocaleString() ?? 0}</TableCell>
                            <TableCell className="font-mono text-xs text-right">{entry.records_stored?.toLocaleString() ?? 0}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                "text-[10px]",
                                entry.status === "ok" ? "text-[var(--win)]" : "text-[var(--loss)]"
                              )}>
                                {entry.status?.toUpperCase() ?? "OK"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

              {/* Alerts */}
              {governance.alerts.length > 0 && (
                <section className="space-y-3">
                  <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Alerts
                  </h2>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {governance.alerts.map((alert, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-md border p-3">
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", severityBadge(alert.severity))}>
                          {alert.severity?.toUpperCase() ?? "INFO"}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm">{alert.message}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {alert.created_at?.slice(0, 16) ?? ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
