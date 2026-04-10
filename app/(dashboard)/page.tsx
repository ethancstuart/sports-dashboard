"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "@/components/metric-card";
import { DataTable, type Column } from "@/components/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUnits, fmtPct, fmtCurrency, fmtOdds, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------- types (match API response shapes) ---------- */

interface Summary {
  total_picks: number;
  wins: number;
  losses: number;
  pushes: number;
  total_pnl: number;
  open_bets: number;
  last_sync: string | null;
}

interface Pick {
  game_id: string;
  game_date: string;
  strategy: string;
  sport: string;
  bet_side: string;
  edge: number;
  kelly_size: number;
  book_odds: number;
  predicted_value: number;
  home_team_id: string;
  away_team_id: string;
  result: string | null;
  [key: string]: unknown;
}

interface Result {
  game_id: string;
  strategy: string;
  sport: string;
  bet_side: string;
  result: string;
  pnl: number;
  clv: number;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  [key: string]: unknown;
}

interface Strategy {
  strategy: string;
  sport: string;
  total: number;
  wins: number;
  losses: number;
  total_pnl: number;
  avg_clv: number | null;
  avg_edge: number | null;
  [key: string]: unknown;
}

/* ---------- helpers ---------- */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const BANKROLL_BASE = 200;

/* ---------- column defs ---------- */

const pickColumns: Column<Pick>[] = [
  {
    key: "game",
    header: "Game",
    render: (r) => (
      <span className="whitespace-nowrap font-semibold">
        {r.away_team_id ?? "?"} @ {r.home_team_id ?? "?"}
      </span>
    ),
  },
  {
    key: "sport",
    header: "Sport",
    render: (r) => (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
        {r.sport}
      </span>
    ),
  },
  { key: "strategy", header: "Strategy" },
  {
    key: "bet_side",
    header: "Side",
    render: (r) => (
      <span className="font-semibold uppercase">{r.bet_side ?? "—"}</span>
    ),
  },
  {
    key: "edge",
    header: "Edge%",
    render: (r) => (
      <span className={pnlColor(r.edge)}>{fmtPct(r.edge)}</span>
    ),
  },
  {
    key: "kelly_size",
    header: "Kelly%",
    render: (r) => fmtPct(r.kelly_size),
  },
  {
    key: "book_odds",
    header: "Odds",
    render: (r) => fmtOdds(r.book_odds),
  },
];

const resultColumns: Column<Result>[] = [
  {
    key: "game",
    header: "Game",
    render: (r) => (
      <div>
        <span className="whitespace-nowrap font-semibold">
          {r.away_team_id ?? "?"} @ {r.home_team_id ?? "?"}
        </span>
        {r.home_score != null && (
          <span className="ml-2 text-xs text-muted-foreground">
            {r.away_score}-{r.home_score}
          </span>
        )}
      </div>
    ),
  },
  { key: "strategy", header: "Strategy" },
  {
    key: "bet_side",
    header: "Side",
    render: (r) => (
      <span className="font-semibold uppercase">{r.bet_side ?? "—"}</span>
    ),
  },
  {
    key: "result",
    header: "Result",
    render: (r) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
          r.result === "win"
            ? "bg-[var(--win)]/20 text-[var(--win)]"
            : r.result === "loss"
              ? "bg-[var(--loss)]/20 text-[var(--loss)]"
              : "bg-muted text-muted-foreground"
        )}
      >
        {r.result?.toUpperCase() ?? "PENDING"}
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

  // Compute derived metrics from the actual API response
  const totalSettled = (summary?.wins ?? 0) + (summary?.losses ?? 0) + (summary?.pushes ?? 0);
  const winRate = totalSettled > 0 ? (summary?.wins ?? 0) / totalSettled : null;
  const roi = totalSettled > 0 ? (summary?.total_pnl ?? 0) / totalSettled : null;
  const bankroll = BANKROLL_BASE + (summary?.total_pnl ?? 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-mono text-xl font-bold tracking-tight">
          COMMAND CENTER
        </h1>
        <p className="text-sm text-muted-foreground">
          Portfolio overview &middot; {today()}
          {summary?.last_sync && (
            <span className="ml-3">
              Synced: {new Date(summary.last_sync).toLocaleString()}
            </span>
          )}
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
            value={roi != null ? fmtPct(roi) : "—"}
            className={pnlColor(roi)}
          />
          <MetricCard
            label="Win Rate"
            value={winRate != null ? fmtPct(winRate) : "—"}
          />
          <MetricCard
            label="Open Bets"
            value={String(summary.open_bets)}
          />
          <MetricCard
            label="Settled Bets"
            value={String(totalSettled)}
            subtext={`${summary.wins}W / ${summary.losses}L`}
          />
          <MetricCard
            label="Bankroll"
            value={fmtCurrency(bankroll)}
            subtext={`Base: ${fmtCurrency(BANKROLL_BASE)}`}
          />
        </div>
      )}

      {/* Today's Picks */}
      <section className="space-y-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Picks &middot; {today()}
          {picks && <span className="ml-2 text-xs">({picks.length} bets)</span>}
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
          {results && <span className="ml-2 text-xs">({results.length} settled)</span>}
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

      {/* Strategy Performance */}
      <section className="space-y-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Strategy Performance
        </h2>
        {strategies === null ? (
          <TableSkeleton />
        ) : strategies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No settled bets yet</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {strategies.map((s) => {
              const wr = s.total > 0 ? s.wins / s.total : 0;
              return (
                <Card key={s.strategy}>
                  <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="truncate font-mono text-sm">
                        {s.strategy}
                      </CardTitle>
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                        {s.sport}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="mt-1 grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Record</div>
                        <div className="font-mono font-semibold">
                          {s.wins}-{s.losses}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Win%</div>
                        <div className="font-mono font-semibold">
                          {fmtPct(wr)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">P&L</div>
                        <div
                          className={cn(
                            "font-mono font-semibold",
                            pnlColor(s.total_pnl)
                          )}
                        >
                          {fmtUnits(s.total_pnl)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Edge</div>
                        <div className="font-mono font-semibold">
                          {fmtPct(s.avg_edge)}
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
