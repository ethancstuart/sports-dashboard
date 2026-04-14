"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtUnits, pnlColor, formatBet, fmtOdds } from "@/lib/format";
import { UNIT_SIZE } from "@/lib/constants";

interface LiveGame {
  game_id: string;
  sport: string;
  status: "pre" | "in" | "post";
  status_detail: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  period: string;
  clock: string;
}

interface LivePick {
  game_id: string;
  sport: string;
  strategy: string;
  bet_side: string | null;
  edge: number | null;
  kelly_size: number | null;
  book_odds: number | null;
  book_line: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  live_status: string;
  live_pnl: number;
  home_score: number | null;
  away_score: number | null;
  game_status: string;
}

interface ScoresData {
  games: LiveGame[];
  counts: { total: number; live: number; final: number; upcoming: number };
  fetched_at: string;
}

interface PositionsData {
  picks: LivePick[];
  summary: {
    total: number;
    winning: number;
    losing: number;
    pending: number;
    projected_pnl: number;
  };
}

const SPORT_TABS = ["ALL", "MLB", "NBA", "NFL"] as const;

function statusBadge(status: string) {
  switch (status) {
    case "winning":
    case "won":
      return "bg-[var(--win)]/20 text-[var(--win)] border-[var(--win)]/30";
    case "losing":
    case "lost":
      return "bg-[var(--loss)]/20 text-[var(--loss)] border-[var(--loss)]/30";
    case "tracking":
      return "bg-[var(--paused)]/20 text-[var(--paused)] border-[var(--paused)]/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function gameStatusColor(status: string) {
  if (status === "in") return "text-[var(--live)]";
  if (status === "post") return "text-muted-foreground";
  return "text-muted-foreground/50";
}

export default function LiveTrackerPage() {
  const [scores, setScores] = useState<ScoresData | null>(null);
  const [positions, setPositions] = useState<PositionsData | null>(null);
  const [activeSport, setActiveSport] = useState<string>("ALL");
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const [scoresRes, posRes] = await Promise.all([
        fetch("/api/live/scores"),
        fetch("/api/live/positions"),
      ]);
      if (scoresRes.ok) setScores(await scoresRes.json());
      if (posRes.ok) setPositions(await posRes.json());
      setLastUpdate(new Date().toLocaleTimeString());
    } catch {
      // Silent fail — will retry on next interval
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredGames = scores?.games.filter(
    (g) => activeSport === "ALL" || g.sport === activeSport.toLowerCase()
  ) ?? [];

  const filteredPicks = positions?.picks.filter(
    (p) => activeSport === "ALL" || p.sport === activeSport.toLowerCase()
  ) ?? [];

  const liveGames = filteredGames.filter((g) => g.status === "in");
  const recentlyCompleted = filteredGames.filter((g) => g.status === "post");
  const upcoming = filteredGames.filter((g) => g.status === "pre");

  // Build a map of game_id -> picks for that game
  const picksByGame: Record<string, LivePick[]> = {};
  for (const p of filteredPicks) {
    if (!picksByGame[p.game_id]) picksByGame[p.game_id] = [];
    picksByGame[p.game_id].push(p);
  }

  const summary = positions?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold">Live Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Auto-refreshes every 30s &middot; Last: {lastUpdate || "loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[var(--live)] animate-pulse" />
          <span className="font-mono text-xs text-[var(--live)]">LIVE</span>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Games In Progress
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-[var(--live)]">
              {scores?.counts.live ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Open Bets
            </div>
            <div className="mt-1 font-mono text-2xl font-bold">
              {summary?.total ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Live Exposure
            </div>
            <div className="mt-1 font-mono text-2xl font-bold">
              ${(((filteredPicks.reduce((s, p) => s + (p.kelly_size ?? 0), 0)) * UNIT_SIZE * 10) || 0).toFixed(0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Projected P&L
            </div>
            <div className={`mt-1 font-mono text-2xl font-bold ${pnlColor(summary?.projected_pnl ?? 0)}`}>
              {fmtUnits(summary?.projected_pnl ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sport Tabs */}
      <div className="flex gap-1 border-b border-border pb-1">
        {SPORT_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSport(tab)}
            className={`px-4 py-1.5 font-mono text-xs tracking-wider transition-colors ${
              activeSport === tab
                ? "border-b-2 border-[var(--primary)] text-[var(--primary)] font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Live Games */}
      {liveGames.length > 0 && (
        <div>
          <h2 className="mb-3 font-mono text-sm font-medium uppercase tracking-wider text-[var(--live)]">
            In Progress ({liveGames.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {liveGames.map((game) => (
              <GameCard key={game.game_id} game={game} picks={picksByGame[game.game_id]} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Games with Bets */}
      {upcoming.filter((g) => picksByGame[g.game_id]).length > 0 && (
        <div>
          <h2 className="mb-3 font-mono text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Upcoming with Bets
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {upcoming
              .filter((g) => picksByGame[g.game_id])
              .map((game) => (
                <GameCard key={game.game_id} game={game} picks={picksByGame[game.game_id]} />
              ))}
          </div>
        </div>
      )}

      {/* Recently Completed */}
      {recentlyCompleted.length > 0 && (
        <div>
          <h2 className="mb-3 font-mono text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Completed ({recentlyCompleted.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recentlyCompleted.map((game) => (
              <GameCard key={game.game_id} game={game} picks={picksByGame[game.game_id]} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredGames.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="font-mono text-lg text-muted-foreground">No games found</div>
            <div className="text-sm text-muted-foreground/60">
              Games will appear here when they&apos;re scheduled or in progress
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GameCard({ game, picks }: { game: LiveGame; picks?: LivePick[] }) {
  const isLive = game.status === "in";
  const isFinal = game.status === "post";

  return (
    <Card className={isLive ? "border-[var(--live)]/30" : ""}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {game.sport.toUpperCase()}
          </Badge>
          <span className={`font-mono text-xs ${gameStatusColor(game.status)}`}>
            {isLive && <span className="mr-1">●</span>}
            {game.status_detail || (isFinal ? "FINAL" : "UPCOMING")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {/* Scoreboard */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-2">
          <div className="text-right">
            <div className="font-mono text-sm font-bold">{game.away_team}</div>
          </div>
          <div className="text-center font-mono text-lg font-bold tabular-nums">
            {game.away_score ?? "-"} — {game.home_score ?? "-"}
          </div>
          <div>
            <div className="font-mono text-sm font-bold">{game.home_team}</div>
          </div>
        </div>

        {/* Progress Bar for live games */}
        {isLive && (
          <div className="mb-2">
            <GameProgress sport={game.sport} period={game.period} />
          </div>
        )}

        {/* Active Bets on this game */}
        {picks && picks.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-border pt-2">
            {picks.map((pick, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${statusBadge(pick.live_status)}`}
                  >
                    {pick.live_status.toUpperCase()}
                  </Badge>
                  <span className="font-mono">
                    {formatBet(pick.strategy, pick.bet_side, pick.home_team_id, pick.away_team_id)}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-muted-foreground">{fmtOdds(pick.book_odds)}</span>
                  <span className={pnlColor(pick.live_pnl)}>
                    {pick.live_pnl > 0 ? "+" : ""}{(pick.live_pnl * UNIT_SIZE).toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GameProgress({ sport, period }: { sport: string; period: string }) {
  const p = Math.max(0, parseInt(period) || 0);
  let total = 9;
  let label = "inning";
  if (sport === "nba") { total = 4; label = "quarter"; }
  if (sport === "nfl") { total = 4; label = "quarter"; }

  const pct = total > 0 ? Math.min(Math.max(0, (p / total) * 100), 100) : 0;

  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-0.5">
        <span>{label} {p}/{total}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-[var(--live)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
