import { NextResponse } from "next/server";
import { query } from "@/lib/db";

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

function computeLiveStatus(
  pick: OpenPick,
  homeScore: number | null,
  awayScore: number | null,
  gameStatus: string
): { live_status: string; live_pnl: number } {
  if (homeScore == null || awayScore == null || gameStatus === "pre") {
    return { live_status: "pending", live_pnl: 0 };
  }

  const strategy = pick.strategy;
  const side = (pick.bet_side ?? "").toLowerCase();
  const odds = pick.book_odds ?? -110;
  const winPayout = odds > 0 ? odds / 100 : 100 / Math.abs(odds);

  let isWinning = false;

  if (strategy.includes("nrfi")) {
    isWinning = homeScore === 0 && awayScore === 0;
    // NRFI only cares about 1st inning, but live score is full game
    // Approximate: if runs scored, NRFI lost
  } else if (strategy.includes("yrfi")) {
    isWinning = homeScore > 0 || awayScore > 0;
  } else if (strategy.includes("f5_under")) {
    isWinning = (homeScore + awayScore) < (pick.book_line ?? 5);
  } else if (strategy.includes("_ml")) {
    if (side.includes("home")) {
      isWinning = homeScore > awayScore;
    } else {
      isWinning = awayScore > homeScore;
    }
  } else if (strategy.includes("spread")) {
    const spread = pick.book_line ?? 0;
    if (side.includes("home")) {
      isWinning = homeScore + spread > awayScore;
    } else {
      isWinning = awayScore - spread > homeScore;
    }
  } else if (strategy.includes("total") || strategy.includes("over")) {
    const total = homeScore + awayScore;
    if (side.includes("over")) {
      isWinning = total > (pick.book_line ?? 0);
    } else {
      isWinning = total < (pick.book_line ?? 0);
    }
  }

  const live_pnl = isWinning ? winPayout : -1;
  const live_status = gameStatus === "post"
    ? (isWinning ? "won" : "lost")
    : (isWinning ? "winning" : "losing");

  return { live_status, live_pnl };
}

export async function GET() {
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const picks = await query<OpenPick>(`
      SELECT sp.game_id, sp.game_date, sp.sport, sp.strategy, sp.bet_side,
             sp.predicted_value, sp.book_line, sp.book_odds, sp.edge, sp.kelly_size,
             g.home_team_id, g.away_team_id
      FROM strategy_picks sp
      LEFT JOIN games g ON sp.game_id = g.game_id
      WHERE sp.result IS NULL AND sp.game_date >= $1
      ORDER BY sp.game_date, sp.sport, sp.strategy
    `, [todayStr]);

    // Fetch live scores
    const liveGames: Record<string, { home_score: number; away_score: number; status: string }> = {};
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
      const scoresRes = await fetch(`${baseUrl}/api/live/scores`, { cache: "no-store" });
      if (scoresRes.ok) {
        const scoresData = await scoresRes.json();
        for (const g of scoresData.games ?? []) {
          liveGames[g.game_id] = {
            home_score: g.home_score,
            away_score: g.away_score,
            status: g.status,
          };
        }
      }
    } catch {
      // Live scores unavailable — return picks without live status
    }

    const enriched = picks.map((pick) => {
      const live = liveGames[pick.game_id];
      const { live_status, live_pnl } = live
        ? computeLiveStatus(pick, live.home_score, live.away_score, live.status)
        : { live_status: "pending", live_pnl: 0 };

      return {
        ...pick,
        live_status,
        live_pnl,
        home_score: live?.home_score ?? null,
        away_score: live?.away_score ?? null,
        game_status: live?.status ?? "pre",
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
          pending: enriched.filter((p) => p.live_status === "pending").length,
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
    console.error("Live positions error:", error);
    return NextResponse.json({ error: "Failed to fetch live positions" }, { status: 500 });
  }
}
