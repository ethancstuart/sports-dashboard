import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Force dynamic rendering — this route hits Neon Postgres at request time;
// without force-dynamic, Next.js tries to statically render at build and fails
// on preview branches that don't have DATABASE_URL set.
export const dynamic = 'force-dynamic';

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const SPORT_ENDPOINTS: Record<string, string> = {
  mlb: `${ESPN_BASE}/baseball/mlb/scoreboard`,
  nba: `${ESPN_BASE}/basketball/nba/scoreboard`,
  nfl: `${ESPN_BASE}/football/nfl/scoreboard`,
};

interface OpenPick {
  game_id: string;
  game_date: string;
  sport: string;
  strategy: string;
  bet_side: string | null;
  predicted_value: number | null;
  book_line: number | null;
  book_odds: number | null;
  edge: number | null;
  kelly_size: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

interface LiveGameInfo {
  home_score: number;
  away_score: number;
  status: "pre" | "in" | "post";
  period: number;
}

async function fetchAllLiveScores(): Promise<Record<string, LiveGameInfo>> {
  const liveGames: Record<string, LiveGameInfo> = {};

  const fetches = Object.entries(SPORT_ENDPOINTS).map(async ([, url]) => {
    try {
      const res = await fetch(url, { next: { revalidate: 30 } });
      if (!res.ok) return;
      const data = await res.json();
      for (const ev of data.events ?? []) {
        const comp = (ev.competitions as Record<string, unknown>[])?.[0];
        if (!comp) continue;
        const competitors = (comp.competitors as Record<string, unknown>[]) ?? [];
        const status = ev.status as Record<string, unknown> | undefined;
        const statusType = status?.type as Record<string, unknown> | undefined;
        const state = (statusType?.state as string) ?? "pre";

        const home = competitors.find((c) => c.homeAway === "home");
        const away = competitors.find((c) => c.homeAway === "away");
        if (!home || !away) continue;

        liveGames[ev.id as string] = {
          home_score: home.score != null ? Number(home.score) : 0,
          away_score: away.score != null ? Number(away.score) : 0,
          status: (state === "in" ? "in" : state === "post" ? "post" : "pre") as "pre" | "in" | "post",
          period: (status?.period as number) ?? 0,
        };
      }
    } catch {
      // Individual sport fetch failure is non-fatal
    }
  });

  await Promise.all(fetches);
  return liveGames;
}

function computeLiveStatus(
  pick: OpenPick,
  game: LiveGameInfo
): { live_status: string; live_pnl: number } {
  if (game.status === "pre") {
    return { live_status: "pending", live_pnl: 0 };
  }

  const strategy = pick.strategy;
  const side = (pick.bet_side ?? "").toLowerCase();
  // If odds are null, we can't compute PnL — show as tracking
  if (pick.book_odds == null) {
    return { live_status: "tracking", live_pnl: 0 };
  }
  const odds = pick.book_odds;
  const winPayout = odds > 0 ? odds / 100 : 100 / Math.abs(odds);
  const kellySize = pick.kelly_size ?? 1;
  const { home_score: hs, away_score: as_ } = game;

  let isWinning = false;

  if (strategy.includes("nrfi")) {
    // NRFI: approximate — if any runs scored, likely lost
    // Only truly accurate after 1st inning, but this is best we can do from full-game score
    isWinning = hs === 0 && as_ === 0;
  } else if (strategy.includes("yrfi")) {
    isWinning = hs > 0 || as_ > 0;
  } else if (strategy.includes("f5_under")) {
    // F5 uses first-5-innings score, but ESPN only gives full game score.
    // Mark as "tracking" (approximate) during live, only compute on final.
    if (game.status === "post") {
      // At game end, full score > F5 score, so this is a rough upper bound.
      // Mark as approximate — settlement will use actual F5 data.
      isWinning = (hs + as_) < (pick.book_line ?? 5) * 2; // Very rough heuristic
    } else {
      return { live_status: "tracking", live_pnl: 0 };
    }
  } else if (strategy.includes("_ml")) {
    if (side.includes("home")) {
      isWinning = hs > as_;
    } else {
      isWinning = as_ > hs;
    }
  } else if (strategy.includes("spread")) {
    // book_line is the spread from the bet side's perspective (negative = favorite)
    // e.g., home -3 means home must win by >3; book_line = -3
    const spread = pick.book_line ?? 0;
    if (side.includes("home")) {
      // Home covers if home_score + spread > away_score
      isWinning = hs + spread > as_;
    } else {
      // Away covers if away_score + (-spread) > home_score
      // Since spread is from home perspective, away line = -spread
      isWinning = as_ - spread > hs;
    }
  } else if (strategy.includes("total") || strategy.includes("over") || strategy.includes("under")) {
    const total = hs + as_;
    const line = pick.book_line ?? 0;
    if (side.includes("over")) {
      isWinning = total > line;
    } else {
      isWinning = total < line;
    }
  }

  const live_pnl = isWinning ? winPayout * kellySize : -1 * kellySize;
  const live_status = game.status === "post"
    ? (isWinning ? "won" : "lost")
    : (isWinning ? "winning" : "losing");

  return { live_status, live_pnl };
}

export async function GET() {
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Fetch picks and live scores in parallel (no self-referential fetch)
    const [picks, liveGames] = await Promise.all([
      query<OpenPick>(`
        SELECT sp.game_id, sp.game_date, sp.sport, sp.strategy, sp.bet_side,
               sp.predicted_value, sp.book_line, sp.book_odds, sp.edge, sp.kelly_size,
               g.home_team_id, g.away_team_id
        FROM strategy_picks sp
        LEFT JOIN games g ON sp.game_id = g.game_id
        WHERE sp.result IS NULL AND sp.game_date >= $1
        ORDER BY sp.game_date, sp.sport, sp.strategy
      `, [todayStr]),
      fetchAllLiveScores(),
    ]);

    const enriched = picks.map((pick) => {
      const game = liveGames[pick.game_id];
      const { live_status, live_pnl } = game
        ? computeLiveStatus(pick, game)
        : { live_status: "pending", live_pnl: 0 };

      return {
        ...pick,
        live_status,
        live_pnl,
        home_score: game?.home_score ?? null,
        away_score: game?.away_score ?? null,
        game_status: game?.status ?? "pre",
      };
    });

    const totalLivePnl = enriched.reduce((sum, p) => sum + p.live_pnl, 0);
    const winning = enriched.filter((p) => p.live_status === "winning" || p.live_status === "won").length;
    const losing = enriched.filter((p) => p.live_status === "losing" || p.live_status === "lost").length;

    return NextResponse.json(
      {
        picks: enriched,
        summary: {
          total: enriched.length,
          winning,
          losing,
          pending: enriched.filter((p) => p.live_status === "pending" || p.live_status === "tracking").length,
          projected_pnl: Math.round(totalLivePnl * 100) / 100,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Live positions error:", String(error));
    return NextResponse.json({ error: "Failed to fetch live positions" }, { status: 500 });
  }
}
