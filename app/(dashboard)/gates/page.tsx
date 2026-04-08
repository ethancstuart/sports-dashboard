"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */

interface GateThreshold {
  n: number;
  continue_wr: number;
  kill_wr: number;
}

interface GateStrategy {
  strategy: string;
  sport: string;
  n: number;
  wins: number;
  win_rate: number;
  [key: string]: unknown;
}

/* ---------- gate thresholds (Ulysses Contract) ---------- */

const GATE_THRESHOLDS: Record<string, GateThreshold[]> = {
  mlb_f5_under: [
    { n: 100, continue_wr: 0.58, kill_wr: 0.52 },
    { n: 200, continue_wr: 0.55, kill_wr: 0.52 },
  ],
  mlb_ml: [
    { n: 100, continue_wr: 0.55, kill_wr: 0.5 },
    { n: 200, continue_wr: 0.55, kill_wr: 0.52 },
  ],
  mlb_nrfi: [
    { n: 50, continue_wr: 0.58, kill_wr: 0.52 },
    { n: 100, continue_wr: 0.56, kill_wr: 0.52 },
  ],
  mlb_yrfi: [
    { n: 100, continue_wr: 0.48, kill_wr: 0.44 },
    { n: 200, continue_wr: 0.48, kill_wr: 0.45 },
  ],
  nba_ml: [
    { n: 50, continue_wr: 0.62, kill_wr: 0.55 },
    { n: 100, continue_wr: 0.6, kill_wr: 0.55 },
  ],
  nba_1q_spread: [
    { n: 100, continue_wr: 0.53, kill_wr: 0.48 },
    { n: 200, continue_wr: 0.52, kill_wr: 0.49 },
  ],
  nba_1h_spread: [
    { n: 100, continue_wr: 0.53, kill_wr: 0.48 },
    { n: 200, continue_wr: 0.52, kill_wr: 0.49 },
  ],
  nba_first_10: [
    { n: 100, continue_wr: 0.53, kill_wr: 0.48 },
    { n: 200, continue_wr: 0.52, kill_wr: 0.49 },
  ],
  nba_first_20: [
    { n: 100, continue_wr: 0.53, kill_wr: 0.48 },
    { n: 200, continue_wr: 0.52, kill_wr: 0.49 },
  ],
  nfl_1q_spread: [
    { n: 50, continue_wr: 0.52, kill_wr: 0.47 },
    { n: 100, continue_wr: 0.52, kill_wr: 0.48 },
  ],
  nfl_1h_spread: [
    { n: 50, continue_wr: 0.52, kill_wr: 0.47 },
    { n: 100, continue_wr: 0.52, kill_wr: 0.48 },
  ],
  nfl_first_7: [
    { n: 50, continue_wr: 0.52, kill_wr: 0.47 },
    { n: 100, continue_wr: 0.52, kill_wr: 0.48 },
  ],
  nfl_first_10: [
    { n: 50, continue_wr: 0.52, kill_wr: 0.47 },
    { n: 100, continue_wr: 0.52, kill_wr: 0.48 },
  ],
};

const SPORT_FOR_STRATEGY: Record<string, string> = {
  mlb_f5_under: "MLB",
  mlb_ml: "MLB",
  mlb_nrfi: "MLB",
  mlb_yrfi: "MLB",
  nba_ml: "NBA",
  nba_1q_spread: "NBA",
  nba_1h_spread: "NBA",
  nba_first_10: "NBA",
  nba_first_20: "NBA",
  nfl_1q_spread: "NFL",
  nfl_1h_spread: "NFL",
  nfl_first_7: "NFL",
  nfl_first_10: "NFL",
};

/* ---------- helpers ---------- */

function deriveGateDecision(
  wr: number,
  thresholds: GateThreshold[],
  currentN: number
): string {
  // Find the most recent gate that has been reached
  const passedGates = thresholds.filter((g) => currentN >= g.n);
  if (passedGates.length === 0) return "MONITOR";
  const activeGate = passedGates[passedGates.length - 1];
  if (wr >= activeGate.continue_wr) return "CONTINUE";
  if (wr < activeGate.kill_wr) return "KILL";
  return "MONITOR";
}

function getNextGate(
  thresholds: GateThreshold[],
  currentN: number
): GateThreshold | null {
  return thresholds.find((g) => currentN < g.n) ?? null;
}

function getActiveGate(
  thresholds: GateThreshold[],
  currentN: number
): GateThreshold | null {
  const passed = thresholds.filter((g) => currentN >= g.n);
  return passed.length > 0 ? passed[passed.length - 1] : null;
}

/* ---------- skeleton ---------- */

function GatesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 14 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="mb-3 h-5 w-28" />
            <Skeleton className="mb-2 h-3 w-16" />
            <Skeleton className="mb-2 h-2 w-full" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

export default function StrategyGatesPage() {
  const [gates, setGates] = useState<GateStrategy[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/gates");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setGates(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
        // Use static fallback with zeros
        setGates(
          Object.keys(GATE_THRESHOLDS).map((s) => ({
            strategy: s,
            sport: SPORT_FOR_STRATEGY[s] ?? "—",
            n: 0,
            wins: 0,
            win_rate: 0,
          }))
        );
      }
    }
    load();
  }, []);

  const sportOrder = ["NFL", "MLB", "NBA"];
  const grouped = gates
    ? sportOrder.map((sport) => ({
        sport,
        strategies: gates.filter(
          (g) =>
            (g.sport ?? SPORT_FOR_STRATEGY[g.strategy] ?? "").toUpperCase() ===
            sport
        ),
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-mono text-xl font-bold tracking-tight">
          STRATEGY GATES
        </h1>
        <p className="text-sm text-muted-foreground">
          Ulysses Contract &middot; Pre-committed gate thresholds
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-[var(--paused)]/30 bg-[var(--paused)]/10 px-4 py-2 text-sm text-[var(--paused)]">
          API unavailable: {error}. Showing gate definitions only.
        </div>
      )}

      {gates === null ? (
        <GatesSkeleton />
      ) : (
        grouped.map(({ sport, strategies }) => (
          <section key={sport} className="space-y-3">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {sport}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {strategies.map((s) => {
                const thresholds = GATE_THRESHOLDS[s.strategy] ?? [];
                const wr = s.n > 0 ? s.win_rate : 0;
                const decision = deriveGateDecision(wr, thresholds, s.n);
                const nextGate = getNextGate(thresholds, s.n);
                const activeGate = getActiveGate(thresholds, s.n);
                const progressTarget = nextGate?.n ?? thresholds[thresholds.length - 1]?.n ?? 100;
                const progressPct = Math.min(
                  ((s.n / progressTarget) * 100),
                  100
                );

                return (
                  <Card key={s.strategy}>
                    <CardHeader className="pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="truncate font-mono text-sm">
                          {s.strategy}
                        </CardTitle>
                        <StatusBadge status={decision} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-2">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                        {s.sport ?? SPORT_FOR_STRATEGY[s.strategy]}
                      </span>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Settled</div>
                          <div className="font-mono font-semibold">{s.n}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Wins</div>
                          <div className="font-mono font-semibold">
                            {s.wins}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Win%</div>
                          <div
                            className={cn(
                              "font-mono font-semibold",
                              decision === "CONTINUE"
                                ? "text-[var(--win)]"
                                : decision === "KILL"
                                  ? "text-[var(--loss)]"
                                  : "text-[var(--paused)]"
                            )}
                          >
                            {s.n > 0 ? fmtPct(wr) : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Progress toward next gate */}
                      <div className="space-y-1">
                        <Progress value={progressPct}>
                          <ProgressLabel className="text-[10px] text-muted-foreground">
                            {nextGate
                              ? `${nextGate.n - s.n} bets to gate ${nextGate.n}`
                              : "All gates reached"}
                          </ProgressLabel>
                          <ProgressValue className="text-[10px]">
                            {() => `${s.n}/${progressTarget}`}
                          </ProgressValue>
                        </Progress>
                      </div>

                      {/* Active gate thresholds */}
                      {activeGate && (
                        <div className="rounded border border-foreground/5 bg-muted/30 px-2 py-1.5 text-[10px]">
                          <div className="text-muted-foreground">
                            Gate @ {activeGate.n}
                          </div>
                          <div className="mt-0.5 flex gap-3 font-mono">
                            <span className="text-[var(--win)]">
                              CONT {fmtPct(activeGate.continue_wr, 0)}
                            </span>
                            <span className="text-[var(--loss)]">
                              KILL &lt;{fmtPct(activeGate.kill_wr, 0)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Next gate thresholds */}
                      {nextGate && (
                        <div className="rounded border border-foreground/5 bg-muted/30 px-2 py-1.5 text-[10px]">
                          <div className="text-muted-foreground">
                            Next gate @ {nextGate.n}
                          </div>
                          <div className="mt-0.5 flex gap-3 font-mono">
                            <span className="text-[var(--win)]">
                              CONT {fmtPct(nextGate.continue_wr, 0)}
                            </span>
                            <span className="text-[var(--loss)]">
                              KILL &lt;{fmtPct(nextGate.kill_wr, 0)}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
