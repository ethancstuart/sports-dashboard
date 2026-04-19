/**
 * Daily wave sequencer — TypeScript port of src/sequencer.py
 * (sports-ml-pipeline). Keep these two files in sync.
 *
 * Wave windows are in the USER's local TZ (default Pacific) so W1
 * fires when the user wakes up. Game settle times remain in ET.
 *
 *   W1 — issued 09:00 user-local
 *   W2 — issued 17:00 user-local
 *   W3 — issued 21:00 user-local
 *
 * Override user TZ via NEXT_PUBLIC_DAILY_PLAY_TZ (IANA name).
 *
 * Confidence tiers (from edge field):
 *   HIGH: edge >= 8%
 *   MED : 4% <= edge < 8%
 *   LOW : edge < 4%   (filtered from curated waves; D4 fallback only)
 *
 * Curated markets only — props are dropped (per feedback_pick_types).
 */

export const BASE_BANKROLL = 200;
export const DAILY_GOAL = 1000;
export const HIGH_EDGE = 0.08;
export const MED_EDGE = 0.04;
export const UNIT_DOLLARS = 100;

export const USER_TZ =
  process.env.NEXT_PUBLIC_DAILY_PLAY_TZ ?? "America/Los_Angeles";

export const WAVE_W1_HOUR = 9;
export const WAVE_W2_HOUR = 17;
export const WAVE_W3_HOUR = 21;

export const SPORT_DEFAULT_SETTLE_HOUR: Record<string, number> = {
  mlb: 16,
  nba: 22,
  nfl: 16,
  nhl: 22,
  ncaab: 22,
  ncaaf: 16,
};

export const CURATED_MARKETS = new Set([
  "spread", "total", "ml", "moneyline",
  "1h_spread", "1h_total", "1q_spread", "1q_total", "3q_spread",
  "first_7", "first_10", "first_20",
  "teaser", "parlay",
  "f5_under", "f5_ml", "nrfi", "yrfi", "run_line",
]);

export type Confidence = "HIGH" | "MED" | "LOW";
export type WaveId = "W1" | "W2" | "W3";

export interface SequencerPick {
  pick_id: number;
  sport: string;
  strategy: string;
  game_id: string;
  bet_side: string;
  edge: number;
  book_line: number | null;
  book_odds: number;
  game_date: string;
  estimated_settle_iso: string;
  confidence: Confidence;
  market_type: string;
  rationale: string;
  rationale_tier: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

export interface SequencerWave {
  wave_id: WaveId;
  issue_time_iso: string;
  bankroll_at_wave: number;
  picks: SequencerPick[];
  stake_per_pick: number;
  notes: string;
}

export interface DailyPlan {
  plan_date: string;
  starting_bankroll: number;
  current_bankroll: number;
  daily_goal: number;
  waves: SequencerWave[];
  active_wave_id: WaveId;
}

export function classifyConfidence(edge: number): Confidence {
  if (edge >= HIGH_EDGE) return "HIGH";
  if (edge >= MED_EDGE) return "MED";
  return "LOW";
}

export function inferMarketType(strategy: string): string {
  const s = (strategy || "").toLowerCase();
  if (s.includes("1q_spread")) return "1q_spread";
  if (s.includes("1h_spread")) return "1h_spread";
  if (s.includes("3q_spread")) return "3q_spread";
  if (s.includes("spread")) return "spread";
  if (s.includes("1h_total") || s.includes("first_7") ||
      s.includes("first_10") || s.includes("first_20")) return "1h_total";
  if (s.includes("1q_total")) return "1q_total";
  if (s.includes("total")) return "total";
  if (s.includes("f5_under")) return "f5_under";
  if (s.includes("f5_ml")) return "f5_ml";
  if (s.includes("nrfi")) return "nrfi";
  if (s.includes("yrfi")) return "yrfi";
  if (s.includes("run_line")) return "run_line";
  if (s.includes("ml") || s.includes("moneyline")) return "ml";
  if (s.includes("prop")) return "prop";
  return "unknown";
}

export function isCuratedMarket(strategy: string, marketType: string): boolean {
  const s = (strategy || "").toLowerCase();
  const m = (marketType || "").toLowerCase();
  if (s.includes("prop") || m.includes("prop") || m.includes("player")) {
    return false;
  }
  return CURATED_MARKETS.has(m);
}

/**
 * Build a Date that represents `planDate hour:00:00` in the given IANA TZ.
 * Uses Intl to compute the TZ offset on that exact moment (handles DST).
 */
function dateInTz(planDate: string, hour: number, tz: string): Date {
  const utcAnchor = new Date(`${planDate}T${String(hour).padStart(2, "0")}:00:00Z`);
  const offsetStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  })
    .formatToParts(utcAnchor)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT-05:00";
  const m = offsetStr.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  const sign = m?.[1] === "+" ? 1 : -1;
  const offH = parseInt(m?.[2] ?? "5", 10);
  const offM = parseInt(m?.[3] ?? "0", 10);
  const offsetMs = sign * (offH * 60 + offM) * 60 * 1000;
  return new Date(utcAnchor.getTime() - offsetMs);
}

export function estimateSettleTime(gameDate: string, sport: string): Date {
  const hour = SPORT_DEFAULT_SETTLE_HOUR[(sport || "").toLowerCase()] ?? 22;
  return dateInTz(gameDate, hour, "America/New_York");
}

export function waveIssueTime(planDate: string, waveId: WaveId): Date {
  const hour = waveId === "W1" ? WAVE_W1_HOUR
             : waveId === "W2" ? WAVE_W2_HOUR
             : WAVE_W3_HOUR;
  return dateInTz(planDate, hour, USER_TZ);
}

export function assignToWave(settleEt: Date, planDate: string): WaveId {
  const w2 = waveIssueTime(planDate, "W2");
  const w3 = waveIssueTime(planDate, "W3");
  if (settleEt <= w2) return "W1";
  if (settleEt <= w3) return "W2";
  return "W3";
}

/** Determine the currently-active wave based on now() in ET. */
export function currentWaveId(planDate: string, now: Date = new Date()): WaveId {
  const w2 = waveIssueTime(planDate, "W2");
  const w3 = waveIssueTime(planDate, "W3");
  if (now < w2) return "W1";
  if (now < w3) return "W2";
  return "W3";
}

interface RawPickRow {
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
}

/** Convert a DB row into a SequencerPick + filter out non-curated markets. */
export function buildPickFromRow(row: RawPickRow): SequencerPick | null {
  const edge = Number(row.edge ?? 0);
  const marketType = inferMarketType(row.strategy ?? "");
  if (!isCuratedMarket(row.strategy ?? "", marketType)) return null;
  return {
    pick_id: row.pick_id,
    sport: row.sport ?? "",
    strategy: row.strategy ?? "",
    game_id: row.game_id ?? "",
    bet_side: row.bet_side ?? "",
    edge,
    book_line: row.book_line,
    book_odds: row.book_odds ?? -110,
    game_date: row.game_date,
    estimated_settle_iso: estimateSettleTime(row.game_date, row.sport ?? "").toISOString(),
    confidence: classifyConfidence(edge),
    market_type: marketType,
    rationale: (row.one_liner ?? "").trim(),
    rationale_tier: row.ew_tier ?? null,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
  };
}

/** Choose picks for one wave + return notes (D4 fallback). */
function selectForWave(
  candidates: SequencerPick[],
  waveId: WaveId,
  maxPicks: number,
): { picks: SequencerPick[]; notes: string } {
  if (candidates.length === 0) {
    return { picks: [], notes: "no picks for this wave" };
  }
  const highMed = candidates.filter(p => p.confidence === "HIGH" || p.confidence === "MED");
  if (highMed.length > 0) {
    if (waveId === "W1") {
      highMed.sort((a, b) =>
        b.edge - a.edge || a.estimated_settle_iso.localeCompare(b.estimated_settle_iso));
    } else {
      highMed.sort((a, b) => b.edge - a.edge);
    }
    return { picks: highMed.slice(0, maxPicks), notes: "" };
  }
  // D4 fallback
  candidates.sort((a, b) => b.edge - a.edge);
  return { picks: candidates.slice(0, 1), notes: "below threshold — best available shown" };
}

export interface BuildPlanOpts {
  planDate: string;
  startingBankroll?: number;
  currentBankroll?: number;
  dailyGoal?: number;
  maxPicksPerWave?: number;
  picks: SequencerPick[];
}

export function buildDailyPlan(opts: BuildPlanOpts): DailyPlan {
  const startingBankroll = opts.startingBankroll ?? BASE_BANKROLL;
  const currentBankroll = opts.currentBankroll ?? startingBankroll;
  const dailyGoal = opts.dailyGoal ?? DAILY_GOAL;
  const maxPicksPerWave = opts.maxPicksPerWave ?? 2;

  const bucket: Record<WaveId, SequencerPick[]> = { W1: [], W2: [], W3: [] };
  for (const p of opts.picks) {
    const settle = new Date(p.estimated_settle_iso);
    bucket[assignToWave(settle, opts.planDate)].push(p);
  }

  const waves: SequencerWave[] = (["W1", "W2", "W3"] as WaveId[]).map(wid => {
    const { picks, notes } = selectForWave(bucket[wid], wid, maxPicksPerWave);
    // For Phase 1: bankroll passed forward unchanged. Mid-day re-runs
    // on the API will recompute current_bankroll from realized PnL.
    const stake = picks.length > 0 ? Number((currentBankroll / picks.length).toFixed(2)) : 0;
    return {
      wave_id: wid,
      issue_time_iso: waveIssueTime(opts.planDate, wid).toISOString(),
      bankroll_at_wave: Number(currentBankroll.toFixed(2)),
      picks,
      stake_per_pick: stake,
      notes,
    };
  });

  return {
    plan_date: opts.planDate,
    starting_bankroll: startingBankroll,
    current_bankroll: Number(currentBankroll.toFixed(2)),
    daily_goal: dailyGoal,
    waves,
    active_wave_id: currentWaveId(opts.planDate),
  };
}
