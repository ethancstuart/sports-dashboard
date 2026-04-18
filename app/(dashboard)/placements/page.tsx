"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { displayStrategy, fmtOdds, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * My Bets — the Decision Ledger feed.
 *
 * Every row is a placed bet the user recorded via the "Mark Placed"
 * button on the home page's pick cards. Summary tiles show realized
 * vs hypothetical CLV so the user can see execution quality separate
 * from model quality. This is the piece that converts EdgeWatch from
 * a model telemetry layer into a bettor P&L system — without it, CLV
 * is hypothetical.
 */

interface Placement {
  placement_id: number;
  pick_id: number;
  placed_at: string;
  book: string;
  line_taken: number | null;
  odds_taken: number | null;
  stake: number;
  notes: string | null;
  settled_result: string | null;
  realized_pnl: number | null;
  realized_clv: number | null;
  strategy: string;
  bet_side: string | null;
  game_date: string;
  book_odds: number | null;
  edge: number | null;
  result: string | null;
  clv: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

function sumBy<T>(items: T[], fn: (x: T) => number): number {
  return items.reduce((acc, x) => acc + fn(x), 0);
}

function fmtCurrency(n: number, digits: number = 2): string {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toFixed(digits)}`;
}

function fmtDateTime(s: string): string {
  const d = new Date(s);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export default function PlacementsPage() {
  const [rows, setRows] = useState<Placement[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/placements?limit=200", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    if (!rows) return null;
    const settled = rows.filter((r) => r.settled_result != null);
    const totalStake = sumBy(rows, (r) => r.stake);
    const settledStake = sumBy(settled, (r) => r.stake);
    const realizedPnl = sumBy(settled, (r) => r.realized_pnl ?? 0);
    const roi = settledStake > 0 ? realizedPnl / settledStake : 0;
    const modelClv = settled.filter((r) => r.clv != null);
    const realClv = settled.filter((r) => r.realized_clv != null);
    const avgModelClv =
      modelClv.length > 0
        ? modelClv.reduce((a, r) => a + (r.clv ?? 0), 0) / modelClv.length
        : 0;
    const avgRealClv =
      realClv.length > 0
        ? realClv.reduce((a, r) => a + (r.realized_clv ?? 0), 0) / realClv.length
        : 0;
    const wins = settled.filter((r) => r.settled_result === "win").length;
    const losses = settled.filter((r) => r.settled_result === "loss").length;
    return {
      totalCount: rows.length,
      settledCount: settled.length,
      openCount: rows.length - settled.length,
      totalStake,
      settledStake,
      realizedPnl,
      roi,
      wins,
      losses,
      avgModelClv,
      avgRealClv,
      executionDelta: avgRealClv - avgModelClv,
    };
  }, [rows]);

  if (err) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <Card>
          <CardContent className="p-6 text-destructive">
            Failed to load placements: {err}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header>
        <h1 className="text-2xl font-bold">My Bets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Decision Ledger — every bet you&apos;ve recorded via the
          &ldquo;Mark Placed&rdquo; button. Realized P&amp;L and CLV are
          computed from the line/odds you actually got; the gap between
          realized and model CLV is your execution quality.
        </p>
      </header>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows == null ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-2 h-8 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Realized P&amp;L
                </div>
                <div
                  className={cn(
                    "mt-1 text-2xl font-semibold tabular-nums",
                    (summary?.realizedPnl ?? 0) > 0
                      ? "text-[var(--win)]"
                      : (summary?.realizedPnl ?? 0) < 0
                      ? "text-[var(--loss)]"
                      : ""
                  )}
                >
                  {fmtCurrency(summary?.realizedPnl ?? 0)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  on ${summary?.settledStake.toFixed(0) ?? 0} settled
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  ROI
                </div>
                <div
                  className={cn(
                    "mt-1 text-2xl font-semibold tabular-nums",
                    (summary?.roi ?? 0) > 0
                      ? "text-[var(--win)]"
                      : (summary?.roi ?? 0) < 0
                      ? "text-[var(--loss)]"
                      : ""
                  )}
                >
                  {fmtPct(summary?.roi ?? 0, 1)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {summary?.wins}-{summary?.losses} settled
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Realized CLV
                </div>
                <div
                  className={cn(
                    "mt-1 text-2xl font-semibold tabular-nums",
                    (summary?.avgRealClv ?? 0) > 0
                      ? "text-[var(--win)]"
                      : "text-muted-foreground"
                  )}
                >
                  {fmtPct(summary?.avgRealClv ?? 0, 2)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  avg vs close
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Exec Δ
                </div>
                <div
                  className={cn(
                    "mt-1 text-2xl font-semibold tabular-nums",
                    (summary?.executionDelta ?? 0) >= 0
                      ? "text-[var(--win)]"
                      : "text-[var(--loss)]"
                  )}
                >
                  {fmtPct(summary?.executionDelta ?? 0, 2)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  realized − model CLV
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Feed table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent placements
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows == null ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No bets recorded yet.{" "}
              <a href="/" className="font-medium underline">
                Go to Today
              </a>{" "}
              and click &ldquo;Mark Placed&rdquo; on a pick to start building
              your Decision Ledger.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Placed</th>
                    <th className="px-3 py-2">Matchup</th>
                    <th className="px-3 py-2">Strategy</th>
                    <th className="px-3 py-2">Book</th>
                    <th className="px-3 py-2 text-right">Stake</th>
                    <th className="px-3 py-2 text-right">Odds taken</th>
                    <th className="px-3 py-2 text-right">Result</th>
                    <th className="px-3 py-2 text-right">P&amp;L</th>
                    <th className="px-3 py-2 text-right">CLV</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const matchup =
                      r.home_team_id && r.away_team_id
                        ? `${r.away_team_id} @ ${r.home_team_id}`
                        : r.game_date;
                    const resultCls =
                      r.settled_result === "win"
                        ? "text-[var(--win)]"
                        : r.settled_result === "loss"
                        ? "text-[var(--loss)]"
                        : "text-muted-foreground";
                    const pnlCls =
                      (r.realized_pnl ?? 0) > 0
                        ? "text-[var(--win)]"
                        : (r.realized_pnl ?? 0) < 0
                        ? "text-[var(--loss)]"
                        : "text-muted-foreground";
                    return (
                      <tr
                        key={r.placement_id}
                        className="border-b last:border-0 tabular-nums"
                      >
                        <td className="px-3 py-2 text-[11px] text-muted-foreground">
                          {fmtDateTime(r.placed_at)}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium">
                          {matchup}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {displayStrategy(r.strategy)}
                          <span className="ml-1 text-muted-foreground">
                            · {r.bet_side ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs uppercase">{r.book}</td>
                        <td className="px-3 py-2 text-right">
                          ${r.stake.toFixed(0)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.odds_taken != null
                            ? fmtOdds(r.odds_taken)
                            : "—"}
                        </td>
                        <td
                          className={cn("px-3 py-2 text-right text-xs font-semibold uppercase", resultCls)}
                        >
                          {r.settled_result ?? "open"}
                        </td>
                        <td className={cn("px-3 py-2 text-right font-semibold", pnlCls)}>
                          {r.realized_pnl != null
                            ? fmtCurrency(r.realized_pnl)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.realized_clv != null
                            ? fmtPct(r.realized_clv, 2)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
