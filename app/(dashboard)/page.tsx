"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Area, AreaChart,
} from "recharts";
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
  urgency: "HIGH" | "MEDIUM" | "LOW";
  [key: string]: unknown;
}

interface StratPerf {
  strategy: string;
  total: number;
  wins: number;
  losses: number;
  total_pnl: number;
  avg_edge: number | null;
  avg_clv: number | null;
}

interface EquityPoint {
  strategy: string;
  sport: string;
  game_date: string;
  daily_pnl: number;
  cumulative_pnl: number;
  bets: number;
  wins: number;
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

/* ---------- constants ---------- */

const TABS = ["MLB", "NBA", "NFL", "PORTFOLIO"] as const;
type Tab = (typeof TABS)[number];

const SPORT_MAP: Record<string, string> = { MLB: "mlb", NBA: "nba", NFL: "nfl" };

const URGENCY_BORDER: Record<string, string> = {
  HIGH: "border-l-4 border-l-red-500",
  MEDIUM: "border-l-4 border-l-amber-500",
  LOW: "border-l-4 border-l-border",
};

const URGENCY_LABEL: Record<string, { text: string; color: string }> = {
  HIGH: { text: "BET NOW", color: "text-red-400 bg-red-500/10" },
  MEDIUM: { text: "ACTIVE", color: "text-amber-400 bg-amber-500/10" },
  LOW: { text: "TRACKING", color: "text-muted-foreground bg-muted" },
};

/* ---------- page ---------- */

export default function EdgeWatch() {
  const [tab, setTab] = useState<Tab>("MLB");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/summary")
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => setError("Failed to connect"));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 font-mono text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-colors",
                tab === t
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {summary && (
          <div className="hidden items-center gap-5 pr-4 font-mono text-xs md:flex">
            <span className={cn("font-semibold tabular-nums", pnlColor(summary.total_pnl))}>
              P&L {fmtUnits(summary.total_pnl)}
            </span>
            <span className="text-muted-foreground">
              BANKROLL {fmtCurrency(BANKROLL_BASE + summary.total_pnl * UNIT_SIZE)}
            </span>
            <span className="text-muted-foreground">
              {summary.wins}W-{summary.losses}L
            </span>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === "PORTFOLIO" ? (
          <PortfolioTab />
        ) : (
          <SportTab sport={SPORT_MAP[tab]} sportLabel={tab} />
        )}
      </div>
    </div>
  );
}

/* ================================================================
   SPORT TAB — picks + strategy performance for a single sport
   ================================================================ */

function SportTab({ sport, sportLabel }: { sport: string; sportLabel: string }) {
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [perf, setPerf] = useState<StratPerf[] | null>(null);
  const [settlements, setSettlements] = useState<Settlement[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/sport-picks?date=${localToday()}&sport=${sport}`, { signal: controller.signal }),
      fetch("/api/settlements", { signal: controller.signal }),
    ])
      .then(async ([pickRes, settleRes]) => {
        const pickData = await pickRes.json();
        const settleData = await settleRes.json();
        setPicks(Array.isArray(pickData.picks) ? pickData.picks : []);
        setPerf(Array.isArray(pickData.performance) ? pickData.performance : []);
        setSettlements(
          Array.isArray(settleData)
            ? settleData.filter((s: Settlement) => s.sport === sport)
            : []
        );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [sport]);

  const grouped = useMemo(() => {
    if (!picks) return {};
    const g: Record<string, Pick[]> = {};
    for (const p of picks) {
      const key = `${p.away_team_id} @ ${p.home_team_id}`;
      if (!g[key]) g[key] = [];
      g[key].push(p);
    }
    return g;
  }, [picks]);

  // Sort games by highest urgency pick
  const sortedGames = useMemo(() => {
    const urgencyRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return Object.entries(grouped).sort(([, a], [, b]) => {
      const aMax = Math.min(...a.map((p) => urgencyRank[p.urgency] ?? 2));
      const bMax = Math.min(...b.map((p) => urgencyRank[p.urgency] ?? 2));
      if (aMax !== bMax) return aMax - bMax;
      const aKelly = Math.max(...a.map((p) => p.kelly_size ?? 0));
      const bKelly = Math.max(...b.map((p) => p.kelly_size ?? 0));
      return bKelly - aKelly;
    });
  }, [grouped]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      {/* LEFT: Signal cards (3/4) */}
      <div className="space-y-3 lg:col-span-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider">
            {sportLabel} Signals &middot; {localToday()}
          </h2>
          {picks && (
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> BET NOW
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> ACTIVE
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-border" /> TRACKING
              </span>
            </div>
          )}
        </div>

        {picks === null ? (
          <LoadingSkeleton rows={4} />
        ) : sortedGames.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center font-mono text-sm text-muted-foreground">
              No {sportLabel} games on the slate today
            </CardContent>
          </Card>
        ) : (
          sortedGames.map(([matchup, gamePicks]) => (
            <GameCard key={matchup} matchup={matchup} picks={gamePicks} />
          ))
        )}
      </div>

      {/* RIGHT: Sport sidebar (1/4) */}
      <div className="space-y-4">
        {/* Strategy performance for this sport */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {sportLabel} Strategy Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {perf === null ? (
              <div className="p-4"><Skeleton className="h-24 w-full" /></div>
            ) : perf.length === 0 ? (
              <div className="p-4 text-center font-mono text-xs text-muted-foreground">
                No settled {sportLabel} bets yet
              </div>
            ) : (
              perf.map((s) => {
                const wr = s.total > 0 ? s.wins / s.total : 0;
                return (
                  <div key={s.strategy} className="flex items-center justify-between border-b border-border/30 px-4 py-2.5 font-mono text-xs last:border-b-0">
                    <div>
                      <div className="font-semibold">{s.strategy.replace(`${sport}_`, "").toUpperCase()}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.wins}W-{s.losses}L &middot; {fmtPct(wr)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("font-semibold tabular-nums", pnlColor(s.total_pnl))}>
                        {fmtUnits(s.total_pnl)}
                      </div>
                      {s.avg_edge != null && (
                        <div className="text-[10px] text-muted-foreground">
                          edge {fmtPct(s.avg_edge)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent settlements for this sport */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Recent {sportLabel} Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {settlements === null ? (
              <div className="p-4"><Skeleton className="h-24 w-full" /></div>
            ) : settlements.length === 0 ? (
              <div className="p-4 text-center font-mono text-xs text-muted-foreground">
                No recent results
              </div>
            ) : (
              <div className="max-h-[350px] overflow-y-auto">
                {settlements.slice(0, 12).map((s, i) => {
                  const bet = formatBet(s.strategy, s.bet_side, s.home_team_id, s.away_team_id);
                  const isWin = s.result === "win";
                  const isLoss = s.result === "loss";
                  return (
                    <div key={`${s.game_id}-${i}`} className="flex items-center justify-between border-b border-border/30 px-4 py-2 font-mono text-xs last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold",
                          isWin ? "bg-[var(--win)]/20 text-[var(--win)]"
                            : isLoss ? "bg-[var(--loss)]/20 text-[var(--loss)]"
                              : "bg-muted text-muted-foreground"
                        )}>
                          {isWin ? "W" : isLoss ? "L" : "P"}
                        </span>
                        <span className="truncate">{bet}</span>
                      </div>
                      <span className={cn("tabular-nums", pnlColor(s.pnl))}>{fmtUnits(s.pnl)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================
   GAME CARD — per-game breakdown with all strategy signals
   ================================================================ */

function GameCard({ matchup, picks }: { matchup: string; picks: Pick[] }) {
  const topUrgency = picks.reduce(
    (best, p) => {
      const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (rank[p.urgency] ?? 2) < (rank[best] ?? 2) ? p.urgency : best;
    },
    "LOW" as "HIGH" | "MEDIUM" | "LOW"
  );

  const sorted = [...picks].sort((a, b) => strategySort(a.strategy, b.strategy));

  return (
    <Card className={cn("overflow-hidden", URGENCY_BORDER[topUrgency])}>
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-mono text-sm font-bold">{matchup}</CardTitle>
          <span className={cn(
            "rounded px-2 py-0.5 font-mono text-[9px] font-bold uppercase",
            URGENCY_LABEL[topUrgency].color
          )}>
            {URGENCY_LABEL[topUrgency].text}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        {sorted.map((pick, i) => (
          <SignalRow key={`${pick.strategy}-${i}`} pick={pick} />
        ))}
      </CardContent>
    </Card>
  );
}

/* ================================================================
   SIGNAL ROW — individual strategy signal within a game card
   ================================================================ */

function SignalRow({ pick }: { pick: Pick }) {
  const bet = formatBet(pick.strategy, pick.bet_side, pick.home_team_id, pick.away_team_id);
  const confidence = pick.predicted_value != null
    ? Math.max(pick.predicted_value as number, 1 - (pick.predicted_value as number))
    : null;

  return (
    <div className="flex items-center justify-between border-t border-border/30 px-4 py-2.5">
      {/* Left: bet label + confidence bar */}
      <div className="flex items-center gap-3">
        <span className={cn(
          "inline-flex min-w-[90px] items-center justify-center rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
          pick.urgency === "HIGH" ? "bg-red-500/10 text-red-400"
            : pick.urgency === "MEDIUM" ? "bg-amber-500/10 text-amber-400"
              : "bg-muted text-muted-foreground"
        )}>
          {bet}
        </span>

        {/* Confidence bar */}
        {confidence != null && (
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full",
                  confidence > 0.65 ? "bg-[var(--win)]"
                    : confidence > 0.55 ? "bg-amber-500"
                      : "bg-muted-foreground"
                )}
                style={{ width: `${Math.min(confidence * 100, 100)}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Right: metrics */}
      <div className="flex items-center gap-5 font-mono text-xs tabular-nums">
        <Metric label="EDGE" value={fmtPct(pick.edge)} color={pnlColor(pick.edge)} />
        <Metric label="KELLY" value={fmtPct(pick.kelly_size)} />
        <Metric label="ODDS" value={fmtOdds(pick.book_odds)} />
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-right">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className={cn("text-xs font-semibold", color)}>{value}</div>
    </div>
  );
}

/* ================================================================
   PORTFOLIO TAB — equity curves, strategy health, full historical
   ================================================================ */

function PortfolioTab() {
  const [equity, setEquity] = useState<EquityPoint[] | null>(null);
  const [strategies, setStrategies] = useState<StratPerf[] | null>(null);
  const [pnlData, setPnlData] = useState<Array<{ game_date: string; cumulative_pnl: number; daily_pnl: number }> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/strategy-equity", { signal: controller.signal }),
      fetch("/api/strategies", { signal: controller.signal }),
      fetch("/api/pnl?days=365", { signal: controller.signal }),
    ])
      .then(async ([eqRes, stratRes, pnlRes]) => {
        setEquity(await eqRes.json());
        setStrategies(await stratRes.json());
        const pnl = await pnlRes.json();
        setPnlData(Array.isArray(pnl) ? [...pnl].reverse() : []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Build per-strategy equity series
  const strategyCurves = useMemo(() => {
    if (!equity || !Array.isArray(equity)) return {};
    const curves: Record<string, Array<{ date: string; pnl: number }>> = {};
    for (const pt of equity) {
      if (!curves[pt.strategy]) curves[pt.strategy] = [];
      curves[pt.strategy].push({ date: pt.game_date, pnl: pt.cumulative_pnl * UNIT_SIZE });
    }
    return curves;
  }, [equity]);

  const totalPnlSeries = useMemo(() => {
    if (!pnlData) return [];
    return pnlData.map((d) => ({
      date: d.game_date,
      pnl: d.cumulative_pnl * UNIT_SIZE,
      daily: d.daily_pnl * UNIT_SIZE,
    }));
  }, [pnlData]);

  // Compute max drawdown
  const maxDrawdown = useMemo(() => {
    if (!totalPnlSeries.length) return 0;
    let peak = -Infinity;
    let dd = 0;
    for (const pt of totalPnlSeries) {
      if (pt.pnl > peak) peak = pt.pnl;
      const drawdown = peak - pt.pnl;
      if (drawdown > dd) dd = drawdown;
    }
    return dd;
  }, [totalPnlSeries]);

  return (
    <div className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {strategies && (
          <>
            <MiniMetric
              label="Total P&L"
              value={fmtCurrency(strategies.reduce((s, x) => s + x.total_pnl, 0) * UNIT_SIZE)}
              color={pnlColor(strategies.reduce((s, x) => s + x.total_pnl, 0))}
            />
            <MiniMetric
              label="Win Rate"
              value={fmtPct(
                strategies.reduce((s, x) => s + x.wins, 0) /
                Math.max(strategies.reduce((s, x) => s + x.total, 0), 1)
              )}
            />
            <MiniMetric
              label="Total Bets"
              value={String(strategies.reduce((s, x) => s + x.total, 0))}
            />
            <MiniMetric
              label="Max Drawdown"
              value={fmtCurrency(maxDrawdown)}
              color="text-[var(--loss)]"
            />
          </>
        )}
      </div>

      {/* Main equity curve */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Portfolio Equity Curve
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalPnlSeries.length === 0 ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={totalPnlSeries}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0 0)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "oklch(0.55 0 0)" }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "oklch(0.55 0 0)" }}
                  tickFormatter={(v: number) => `$${v}`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "oklch(0.16 0.005 260)", border: "1px solid oklch(0.28 0.005 260)", fontSize: 11, fontFamily: "monospace" }}
                  formatter={(v: unknown) => [`$${Number(v).toFixed(0)}`, "P&L"]}
                  labelFormatter={(l: unknown) => String(l)}
                />
                <ReferenceLine y={0} stroke="oklch(0.4 0 0)" />
                <Area type="monotone" dataKey="pnl" stroke="oklch(0.72 0.19 145)" fill="url(#pnlGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Strategy equity curves grid */}
      <div>
        <h3 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Strategy Equity Curves
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(strategyCurves).map(([strategy, data]) => {
            const finalPnl = data.length > 0 ? data[data.length - 1].pnl : 0;
            return (
              <Card key={strategy}>
                <CardContent className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold">
                      {strategy.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <span className={cn("font-mono text-xs font-semibold tabular-nums", pnlColor(finalPnl))}>
                      {fmtCurrency(finalPnl)}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={data}>
                      <ReferenceLine y={0} stroke="oklch(0.3 0 0)" />
                      <Line
                        type="monotone"
                        dataKey="pnl"
                        stroke={finalPnl >= 0 ? "oklch(0.72 0.19 145)" : "oklch(0.65 0.2 25)"}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Strategy table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            All Strategies — Lifetime Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {strategies === null ? (
            <div className="p-4"><Skeleton className="h-32 w-full" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2 text-left">Strategy</th>
                    <th className="px-3 py-2 text-right">Bets</th>
                    <th className="px-3 py-2 text-right">W-L</th>
                    <th className="px-3 py-2 text-right">Win%</th>
                    <th className="px-3 py-2 text-right">P&L</th>
                    <th className="px-3 py-2 text-right">ROI</th>
                    <th className="px-3 py-2 text-right">Avg Edge</th>
                    <th className="px-3 py-2 text-right">Avg CLV</th>
                  </tr>
                </thead>
                <tbody>
                  {strategies.map((s) => {
                    const wr = s.total > 0 ? s.wins / s.total : 0;
                    const roi = s.total > 0 ? s.total_pnl / s.total : 0;
                    return (
                      <tr key={s.strategy} className="border-b border-border/30 hover:bg-accent/30">
                        <td className="px-4 py-2 font-semibold">{s.strategy}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.total}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.wins}-{s.losses}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtPct(wr)}</td>
                        <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", pnlColor(s.total_pnl))}>
                          {fmtUnits(s.total_pnl)}
                        </td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", pnlColor(roi))}>
                          {fmtPct(roi)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtPct(s.avg_edge)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtPct(s.avg_clv)}</td>
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

/* ---------- shared components ---------- */

function MiniMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("mt-0.5 font-mono text-lg font-bold tabular-nums", color)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
