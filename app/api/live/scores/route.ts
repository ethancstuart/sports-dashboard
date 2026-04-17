import { NextResponse } from "next/server";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

const SPORT_ENDPOINTS: Record<string, string> = {
  mlb: `${ESPN_BASE}/baseball/mlb/scoreboard`,
  nba: `${ESPN_BASE}/basketball/nba/scoreboard`,
  nfl: `${ESPN_BASE}/football/nfl/scoreboard`,
};

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
  start_time: string;
}

async function fetchSport(sport: string): Promise<LiveGame[]> {
  try {
    const res = await fetch(SPORT_ENDPOINTS[sport], {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const events = data.events ?? [];

    return events.map((ev: Record<string, unknown>) => {
      const comp = (ev.competitions as Record<string, unknown>[])?.[0];
      const competitors = comp?.competitors as Record<string, unknown>[] ?? [];
      const status = ev.status as Record<string, unknown>;
      const statusType = status?.type as Record<string, unknown>;

      const home = competitors.find((c) => (c.homeAway as string) === "home");
      const away = competitors.find((c) => (c.homeAway as string) === "away");

      const stateMap: Record<string, "pre" | "in" | "post"> = {
        pre: "pre",
        in: "in",
        post: "post",
      };

      return {
        game_id: ev.id as string,
        sport,
        status: stateMap[(statusType?.state as string) ?? "pre"] ?? "pre",
        status_detail: (statusType?.shortDetail as string) ?? "",
        home_team: ((home?.team as Record<string, unknown>)?.abbreviation as string) ?? "",
        away_team: ((away?.team as Record<string, unknown>)?.abbreviation as string) ?? "",
        home_score: home?.score != null ? Number(home.score) : null,
        away_score: away?.score != null ? Number(away.score) : null,
        period: (status?.period as number)?.toString() ?? "",
        clock: (status?.displayClock as string) ?? "",
        start_time: (comp?.date as string) ?? "",
      };
    });
  } catch {
    return [];
  }
}

export async function GET() {
  const [mlb, nba, nfl] = await Promise.all([
    fetchSport("mlb"),
    fetchSport("nba"),
    fetchSport("nfl"),
  ]);

  const games = [...mlb, ...nba, ...nfl];

  return NextResponse.json(
    {
      games,
      counts: {
        total: games.length,
        live: games.filter((g) => g.status === "in").length,
        final: games.filter((g) => g.status === "post").length,
        upcoming: games.filter((g) => g.status === "pre").length,
      },
      fetched_at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
