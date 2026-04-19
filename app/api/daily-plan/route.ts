import { NextResponse } from "next/server";
import { localToday } from "@/lib/constants";
import {
  getDailyPlanPicks,
  getRealizedPnlUnits,
  getDailyPlanSettled,
} from "@/lib/queries";
import {
  BASE_BANKROLL,
  DAILY_GOAL,
  UNIT_DOLLARS,
  buildDailyPlan,
  buildPickFromRow,
  type SequencerPick,
} from "@/lib/sequencer";

export const dynamic = "force-dynamic";

interface RawRow {
  pick_id: number;
  sport: string;
  strategy: string;
  game_id: string;
  bet_side: string | null;
  edge: number | null;
  book_line: number | null;
  book_odds: number | null;
  game_date: string;
  one_liner: string | null;
  ew_tier: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  game_start_time_utc: string | null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? localToday();

  const [rawRowsUnknown, pnlUnits, settledRows] = await Promise.all([
    getDailyPlanPicks(date),
    getRealizedPnlUnits(date),
    getDailyPlanSettled(date),
  ]);
  const rawRows = rawRowsUnknown as unknown as RawRow[];

  const picks: SequencerPick[] = rawRows
    .map((r) => buildPickFromRow(r))
    .filter((p): p is SequencerPick => p !== null);

  const startingBankroll = BASE_BANKROLL;
  const currentBankroll = Number(
    (startingBankroll + pnlUnits * UNIT_DOLLARS).toFixed(2),
  );

  const plan = buildDailyPlan({
    planDate: date,
    startingBankroll,
    currentBankroll,
    dailyGoal: DAILY_GOAL,
    maxPicksPerWave: 2,
    picks,
  });

  return NextResponse.json(
    {
      plan,
      settled: settledRows,
      meta: {
        date,
        starting_bankroll: startingBankroll,
        current_bankroll: currentBankroll,
        realized_pnl_units: pnlUnits,
        unit_dollars: UNIT_DOLLARS,
        total_picks: picks.length,
        generated_at: new Date().toISOString(),
      },
    },
    { headers: { "Cache-Control": "max-age=30, stale-while-revalidate=60" } },
  );
}
