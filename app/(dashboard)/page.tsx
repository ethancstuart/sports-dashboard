"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fmtPct,
  fmtOdds,
  displayStrategy,
  betInstruction,
  edgeTier,
  strategySort,
} from "@/lib/format";
import { localToday } from "@/lib/constants";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────*/

interface Pick {
  game_id: string;
  game_date: string;
  strategy: string;
  sport: string;
  bet_side: string | null;
  edge: number | null;
  kelly_size: number | null;
  book_odds: number | null;
  predicted_value: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  result: string | null;
  [key: string]: unknown;
}

interface ModelHealthRow {
  strategy: string;
  sport: string;
  n: number;
  wins: number;
  losses: number;
  pushes: number;
  actual_wr: number | null;
  breakeven_wr: number | null;
  avg_pred: number | null;
  brier: number | null;
  avg_clv: number | null;
  avg_edge: number | null;
  total_pnl: number;
  last_bet: string | null;
}

/* ────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────*/

const SPORTS = ["MLB", "NBA", "NFL"] as const;
type Sport = (typeof SPORTS)[number];

const TIER_STYLES: Record<"BET" | "LEAN" | "WATCH", string> = {
  BET: "bg-[var(--bet)] text-white",
  LEAN: "bg-[var(--lean)]/15 text-[var(--lean)] ring-1 ring-[var(--lean)]/30",
  WATCH:
    "bg-[var(--watch)]/10 text-[var(--watch)] ring-1 ring-[var(--watch)]/20",
};

/* ────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────*/

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <Header />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TodaysPicks />
        </div>
        <div className="lg:col-span-2">
          <ModelHealth />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Header
   ────────────────────────────────────────────────────────────*/

function Header() {
  // Defer date render to client-only to avoid SSR/CSR hydration mismatch
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    );
  }, []);
  return (
    <div className="flex items-end justify-between border-b border-border pb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">EdgeWatch</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{today}</p>
      </div>
      <div className="text-right text-xs text-muted-foreground">
        <div>Model performance — not P&amp;L</div>
        <div className="tabular-nums">Updated live from DB</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   LEFT COLUMN — Today's picks, grouped by sport
   ────────────────────────────────────────────────────────────*/

function TodaysPicks() {
  const [sport, setSport] = useState<Sport>("MLB");
  const [picks, setPicks] = useState<Pick[] | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    setPicks(null);
    fetch(`/api/sport-picks?date=${localToday()}&sport=${sport.toLowerCase()}`, {
      signal: ctl.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        setPicks(Array.isArray(data.picks) ? data.picks : []);
      })
      .catch(() => setPicks([]));
    return () => ctl.abort();
  }, [sport]);

  const grouped = useMemo(() => {
    if (!picks) return [];
    const byGame = new Map<string, Pick[]>();
    for (const p of picks) {
      const key = `${p.away_team_id ?? "?"} @ ${p.home_team_id ?? "?"}`;
      const arr = byGame.get(key) ?? [];
      arr.push(p);
      byGame.set(key, arr);
    }
    // Sort games by their best (highest-edge) pick
    return Array.from(byGame.entries()).sort(([, a], [, b]) => {
      const aMax = Math.max(...a.map((p) => p.edge ?? 0));
      const bMax = Math.max(...b.map((p) => p.edge ?? 0));
      return bMax - aMax;
    });
  }, [picks]);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">
            Today&rsquo;s Picks
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Plain-English bet instructions · sorted by edge
          </p>
        </div>
        <div className="flex gap-1 rounded-md bg-muted p-1">
          {SPORTS.map((s) => (
            <button
              key={s}
              onClick={() => setSport(s)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                sport === s
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {picks === null ? (
          <LoadingRows rows={4} />
        ) : grouped.length === 0 ? (
          <EmptyState
            title={`No ${sport} games on the slate`}
            body="If you expected games today, check the Pipeline page or daily brief email."
          />
        ) : (
          grouped.map(([matchup, gamePicks]) => (
            <GameBlock
              key={matchup}
              matchup={matchup}
              picks={gamePicks}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function GameBlock({ matchup, picks }: { matchup: string; picks: Pick[] }) {
  const sorted = [...picks].sort((a, b) => strategySort(a.strategy, b.strategy));
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="text-sm font-semibold">{matchup}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {sorted.length} signal{sorted.length === 1 ? "" : "s"}
        </div>
      </div>
      <ul className="divide-y divide-border">
        {sorted.map((p, i) => (
          <PickRow key={`${p.strategy}-${i}`} pick={p} />
        ))}
      </ul>
    </div>
  );
}

function PickRow({ pick }: { pick: Pick }) {
  const tier = edgeTier(pick.edge);
  const instruction = betInstruction(
    pick.strategy,
    pick.bet_side,
    pick.home_team_id,
    pick.away_team_id
  );
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex min-w-[44px] items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              TIER_STYLES[tier]
            )}
          >
            {tier}
          </span>
          <span className="truncate text-sm font-medium">{instruction}</span>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {displayStrategy(pick.strategy)}
          {pick.book_odds != null && ` · ${fmtOdds(pick.book_odds)}`}
          {pick.kelly_size != null &&
            ` · Kelly ${fmtPct(pick.kelly_size, 1)}`}
        </div>
      </div>
      <div className="flex items-center gap-4 tabular-nums">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Edge
          </div>
          <div
            className={cn(
              "text-sm font-semibold",
              (pick.edge ?? 0) > 0
                ? "text-[var(--win)]"
                : "text-muted-foreground"
            )}
          >
            {fmtPct(pick.edge, 1)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Conf
          </div>
          <div className="text-sm font-semibold">
            {pick.predicted_value != null
              ? fmtPct(pick.predicted_value, 0)
              : "—"}
          </div>
        </div>
      </div>
    </li>
  );
}

/* ────────────────────────────────────────────────────────────
   RIGHT COLUMN — Model health (WR vs break-even, Brier, CLV)
   ────────────────────────────────────────────────────────────*/

function ModelHealth() {
  const [rows, setRows] = useState<ModelHealthRow[] | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/model-health", { signal: ctl.signal })
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
    return () => ctl.abort();
  }, []);

  // Aggregate summary across all strategies with ≥20 bets
  const summary = useMemo(() => {
    if (!rows) return null;
    const seasoned = rows.filter((r) => r.n >= 20);
    const n = seasoned.reduce((s, r) => s + r.n, 0);
    const wins = seasoned.reduce((s, r) => s + r.wins, 0);
    const losses = seasoned.reduce((s, r) => s + r.losses, 0);
    const decided = wins + losses;
    const actual = decided > 0 ? wins / decided : 0;
    const avgBreakeven =
      seasoned.length > 0
        ? seasoned.reduce((s, r) => s + (r.breakeven_wr ?? 0), 0) /
          seasoned.length
        : 0;
    const brierVals = seasoned
      .map((r) => r.brier)
      .filter((b): b is number => b != null);
    const brier =
      brierVals.length > 0
        ? brierVals.reduce((s, b) => s + b, 0) / brierVals.length
        : null;
    const clvVals = seasoned
      .map((r) => r.avg_clv)
      .filter((c): c is number => c != null);
    const clv =
      clvVals.length > 0
        ? clvVals.reduce((s, c) => s + c, 0) / clvVals.length
        : null;
    return { n, actual, breakeven: avgBreakeven, brier, clv };
  }, [rows]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Model Health
        </CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Is the model still honest? WR vs break-even, calibration, CLV
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Overall summary */}
        {summary && summary.n > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            <HealthTile
              label="WR vs BE"
              value={fmtPct(summary.actual - summary.breakeven, 1)}
              sub={`${fmtPct(summary.actual, 1)} act · ${fmtPct(
                summary.breakeven,
                1
              )} be`}
              good={summary.actual > summary.breakeven}
            />
            <HealthTile
              label="Brier"
              value={summary.brier != null ? summary.brier.toFixed(3) : "—"}
              sub="lower = sharper"
              good={summary.brier != null && summary.brier < 0.25}
            />
            <HealthTile
              label="CLV"
              value={summary.clv != null ? fmtPct(summary.clv, 1) : "—"}
              sub="mean closing-line value"
              good={summary.clv != null && summary.clv > 0}
            />
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Not enough settled picks yet (need ≥20 per strategy to surface health signals).
          </div>
        )}

        {/* Per-strategy breakdown */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              By Strategy
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {rows ? `${rows.length} strategies` : ""}
            </span>
          </div>
          {rows === null ? (
            <LoadingRows rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No settled picks yet"
              body="Health signals appear once picks settle."
            />
          ) : (
            <div className="space-y-1.5">
              {rows.map((r) => (
                <StrategyHealthRow key={r.strategy} row={r} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StrategyHealthRow({ row }: { row: ModelHealthRow }) {
  const decided = row.wins + row.losses;
  const wr = decided > 0 ? row.wins / decided : 0;
  const be = row.breakeven_wr ?? 0;
  const delta = wr - be;
  const good = delta > 0;
  const seasoned = row.n >= 20;
  return (
    <div className="group rounded-md border border-border/70 bg-card px-3 py-2 transition-colors hover:border-border">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {displayStrategy(row.strategy)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
            {row.n} bet{row.n === 1 ? "" : "s"} · {row.wins}W-{row.losses}L
            {row.pushes > 0 && `-${row.pushes}P`}
            {row.last_bet && ` · last ${row.last_bet.slice(5)}`}
          </div>
        </div>
        <div className="text-right tabular-nums">
          <div
            className={cn(
              "text-sm font-semibold",
              !seasoned
                ? "text-muted-foreground"
                : good
                ? "text-[var(--win)]"
                : "text-[var(--loss)]"
            )}
          >
            {seasoned
              ? `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}pp`
              : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {fmtPct(wr, 1)} vs {fmtPct(be, 1)}
          </div>
        </div>
      </div>
      {/* WR vs breakeven bar */}
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div className="flex h-full">
          <div
            className="h-full bg-muted-foreground/40"
            style={{ width: `${Math.min(be * 100, 100)}%` }}
          />
          <div
            className={cn(
              "h-full",
              good ? "bg-[var(--win)]" : "bg-[var(--loss)]"
            )}
            style={{
              width: `${Math.min(Math.abs(delta) * 100, 100 - be * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Shared
   ────────────────────────────────────────────────────────────*/

function HealthTile({
  label,
  value,
  sub,
  good,
}: {
  label: string;
  value: string;
  sub: string;
  good: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          good ? "text-[var(--win)]" : "text-[var(--loss)]"
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{body}</div>
    </div>
  );
}

function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
