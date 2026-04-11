"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fmtUnits,
  fmtPct,
  fmtCurrency,
  fmtOdds,
  pnlColor,
  formatBet,
  strategySort,
} from "@/lib/format";
import { BANKROLL_BASE, UNIT_SIZE, localToday } from "@/lib/constants";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */

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
  tier: string;
  [key: string]: unknown;
}

interface Settlement {
  game_id: string;
  game_date: string;
  strategy: string;
  sport: string;
  bet_side: string;
  result: string;
  pnl: number;
  clv: number | null;
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

function groupBySport(picks: Pick[]): Record<string, Pick[]> {
  const groups: Record<string, Pick[]> = {};
  for (const p of picks) {
    const sport = (p.sport ?? "OTHER").toUpperCase();
    if (!groups[sport]) groups[sport] = [];
    groups[sport].push(p);
  }
  const order: Record<string, number> = { MLB: 0, NBA: 1, NFL: 2 };
  const sorted: Record<string, Pick[]> = {};
  for (const key of Object.keys(groups).sort(
    (a, b) => (order[a] ?? 99) - (order[b] ?? 99)
  )) {
    sorted[key] = groups[key];
  }
  return sorted;
}

/* ---------- page ---------- */

export default function CommandCenter() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [settlements, setSettlements] = useState<Settlement[] | null>(null);
  const [strategies, setStrategies] = useState<Strategy[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      try {
        const [sumRes, picksRes, settleRes, stratRes] = await Promise.all([
          fetch("/api/summary", { signal }),
          fetch(`/api/picks?date=${localToday()}`, { signal }),
          fetch("/api/settlements", { signal }),
          fetch("/api/strategies", { signal }),
        ]);
        const [sumData, picksData, settleData, stratData] = await Promise.all([
          sumRes.json(),
          picksRes.json(),
          settleRes.json(),
          stratRes.json(),
        ]);
        setSummary(sumData);
        setPicks(Array.isArray(picksData) ? picksData : []);
        setSettlements(Array.isArray(settleData) ? settleData : []);
        setStrategies(Array.isArray(stratData) ? stratData : []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("Failed to load data. Check connection.");
        }
      }
    }
    load();
    return () => controller.abort();
  }, []);

  const actionable = useMemo(
    () => picks?.filter((p) => p.tier === "ACTIONABLE") ?? [],
    [picks]
  );
  const tracking = useMemo(
    () => picks?.filter((p) => p.tier === "TRACKING") ?? [],
    [picks]
  );
  const sportGroups = useMemo(() => groupBySport(actionable), [actionable]);

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card>
          <CardContent className="p-6 text-center font-mono text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg font-bold tracking-tight">
            ACTIVE SIGNALS
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            {localToday()} &middot;{" "}
            {actionable.length} actionable &middot;{" "}
            {tracking.length} tracking
          </p>
        </div>
        {summary && (
          <div className="hidden items-center gap-4 font-mono text-xs md:flex">
            <StatPill
              label="TOTAL P&L"
              value={fmtUnits(summary.total_pnl)}
              color={pnlColor(summary.total_pnl)}
            />
            <StatPill
              label="BANKROLL"
              value={fmtCurrency(BANKROLL_BASE + summary.total_pnl * UNIT_SIZE)}
            />
          </div>
        )}
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT: Active Signals (2/3 width) */}
        <div className="space-y-4 lg:col-span-2">
          {picks === null ? (
            <LoadingSkeleton />
          ) : actionable.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center font-mono text-sm text-muted-foreground">
                No actionable signals for {localToday()}
              </CardContent>
            </Card>
          ) : (
            Object.entries(sportGroups).map(([sport, sportPicks]) => (
              <div key={sport} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {sport}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-1">
                  {sportPicks
                    .sort((a, b) => strategySort(a.strategy, b.strategy))
                    .map((pick, i) => (
                      <SignalRow key={`${pick.game_id}-${pick.strategy}-${i}`} pick={pick} />
                    ))}
                </div>
              </div>
            ))
          )}

          {/* Tracking section (collapsed) */}
          {tracking.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Tracking ({tracking.length}) &mdash; low edge / informational
              </summary>
              <div className="mt-2 space-y-1">
                {tracking
                  .sort((a, b) => strategySort(a.strategy, b.strategy))
                  .map((pick, i) => (
                    <SignalRow
                      key={`track-${pick.game_id}-${pick.strategy}-${i}`}
                      pick={pick}
                      dimmed
                    />
                  ))}
              </div>
            </details>
          )}
        </div>

        {/* RIGHT: Settlement Feed + Strategy Health (1/3 width) */}
        <div className="space-y-4">
          {/* Settlement Feed */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Recent Settlements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              {settlements === null ? (
                <div className="p-4">
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : settlements.length === 0 ? (
                <div className="p-4 text-center font-mono text-xs text-muted-foreground">
                  No recent settlements
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  {settlements.slice(0, 15).map((s, i) => (
                    <SettlementRow key={`${s.game_id}-${s.strategy}-${i}`} s={s} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Strategy Health */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Strategy Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              {strategies === null ? (
                <div className="p-4">
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto">
                  {strategies.map((s) => (
                    <StrategyHealthRow key={s.strategy} s={s} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------- sub-components ---------- */

function SignalRow({ pick, dimmed }: { pick: Pick; dimmed?: boolean }) {
  const bet = formatBet(pick.strategy, pick.bet_side, pick.home_team_id, pick.away_team_id);
  const matchup = `${pick.away_team_id ?? "?"} @ ${pick.home_team_id ?? "?"}`;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border px-3 py-2 font-mono text-sm transition-colors hover:bg-accent/50",
        dimmed && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex min-w-[80px] items-center justify-center rounded px-2 py-0.5 text-[10px] font-bold uppercase",
            !dimmed
              ? "bg-[var(--win)]/15 text-[var(--win)]"
              : "bg-muted text-muted-foreground"
          )}
        >
          {bet}
        </span>
        <span className="text-xs text-muted-foreground">{matchup}</span>
      </div>

      <div className="flex items-center gap-4 text-xs tabular-nums">
        <div className="text-right">
          <span className="text-muted-foreground">EDGE </span>
          <span className={pnlColor(pick.edge)}>{fmtPct(pick.edge)}</span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">KELLY </span>
          <span>{fmtPct(pick.kelly_size)}</span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">ODDS </span>
          <span>{fmtOdds(pick.book_odds)}</span>
        </div>
      </div>
    </div>
  );
}

function SettlementRow({ s }: { s: Settlement }) {
  const bet = formatBet(s.strategy, s.bet_side, s.home_team_id, s.away_team_id);
  const matchup = `${s.away_team_id ?? "?"} @ ${s.home_team_id ?? "?"}`;
  const isWin = s.result === "win";
  const isLoss = s.result === "loss";

  return (
    <div className="flex items-center justify-between border-b border-border/50 px-4 py-2 font-mono text-xs last:border-b-0">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold",
            isWin
              ? "bg-[var(--win)]/20 text-[var(--win)]"
              : isLoss
                ? "bg-[var(--loss)]/20 text-[var(--loss)]"
                : "bg-muted text-muted-foreground"
          )}
        >
          {isWin ? "W" : isLoss ? "L" : "P"}
        </span>
        <div>
          <div className="font-semibold">{bet}</div>
          <div className="text-[10px] text-muted-foreground">{matchup}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={cn("font-semibold tabular-nums", pnlColor(s.pnl))}>
          {fmtUnits(s.pnl)}
        </div>
        {s.home_score != null && (
          <div className="text-[10px] text-muted-foreground">
            {s.away_score}-{s.home_score}
          </div>
        )}
      </div>
    </div>
  );
}

function StrategyHealthRow({ s }: { s: Strategy }) {
  const wr = s.total > 0 ? s.wins / s.total : 0;
  return (
    <div className="flex items-center justify-between border-b border-border/50 px-4 py-2 font-mono text-xs last:border-b-0">
      <div>
        <div className="font-semibold">{s.strategy}</div>
        <div className="text-[10px] text-muted-foreground">
          {s.wins}-{s.losses} &middot; {fmtPct(wr)} win
        </div>
      </div>
      <div className="text-right">
        <div className={cn("font-semibold tabular-nums", pnlColor(s.total_pnl))}>
          {fmtUnits(s.total_pnl)}
        </div>
        {s.avg_edge != null && (
          <div className="text-[10px] text-muted-foreground">
            avg edge {fmtPct(s.avg_edge)}
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", color)}>{value}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
