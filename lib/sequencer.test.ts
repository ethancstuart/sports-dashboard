import { describe, it, expect } from "vitest";
import {
  HIGH_EDGE,
  MED_EDGE,
  MAX_PICK_BANKROLL_FRACTION,
  classifyConfidence,
  inferMarketType,
  isCuratedMarket,
  estimateSettleTime,
  waveIssueTime,
  assignToWave,
  buildPickFromRow,
  buildDailyPlan,
  type SequencerPick,
} from "./sequencer";

function makePick(overrides: Partial<SequencerPick> = {}): SequencerPick {
  const merged: SequencerPick = {
    pick_id: 1,
    sport: "nba",
    strategy: "nba_spread",
    game_id: "g1",
    bet_side: "home",
    edge: 0.1,
    book_line: -2.5,
    book_odds: -110,
    game_date: "2026-04-19",
    estimated_settle_iso: "2026-04-20T02:00:00.000Z", // 22 ET → W2
    confidence: "HIGH",
    market_type: "spread",
    rationale: "",
    rationale_tier: null,
    home_team_id: "BOS",
    away_team_id: "LAL",
    ...overrides,
  };
  // Auto-derive confidence from final edge so tests don't have to set both
  if (!("confidence" in overrides)) {
    merged.confidence = classifyConfidence(merged.edge);
  }
  return merged;
}

describe("classifyConfidence", () => {
  it("returns HIGH at and above 8% edge", () => {
    expect(classifyConfidence(0.10)).toBe("HIGH");
    expect(classifyConfidence(HIGH_EDGE)).toBe("HIGH");
  });
  it("returns MED between 4% and 8%", () => {
    expect(classifyConfidence(0.05)).toBe("MED");
    expect(classifyConfidence(MED_EDGE)).toBe("MED");
  });
  it("returns LOW below 4%", () => {
    expect(classifyConfidence(0.02)).toBe("LOW");
    expect(classifyConfidence(0)).toBe("LOW");
    expect(classifyConfidence(-0.5)).toBe("LOW");
  });
});

describe("inferMarketType", () => {
  it("recognizes common strategies", () => {
    expect(inferMarketType("nba_spread")).toBe("spread");
    expect(inferMarketType("nba_total")).toBe("total");
    expect(inferMarketType("nba_ml")).toBe("ml");
    expect(inferMarketType("nba_1q_spread")).toBe("1q_spread");
    expect(inferMarketType("mlb_nrfi")).toBe("nrfi");
    expect(inferMarketType("mlb_f5_under")).toBe("f5_under");
  });
  it("flags props as prop", () => {
    expect(inferMarketType("nba_player_points_prop")).toBe("prop");
  });
});

describe("isCuratedMarket", () => {
  it("rejects props", () => {
    expect(isCuratedMarket("nba_player_points_prop", "prop")).toBe(false);
    expect(isCuratedMarket("any", "player_points")).toBe(false);
  });
  it("accepts curated markets", () => {
    expect(isCuratedMarket("nba_spread", "spread")).toBe(true);
    expect(isCuratedMarket("mlb_nrfi", "nrfi")).toBe(true);
  });
});

describe("estimateSettleTime", () => {
  it("uses real start_time + sport game length when available", () => {
    const dt = estimateSettleTime("2026-04-20", "mlb", "2026-04-20T22:10:00Z");
    // 22:10 UTC + 3hr MLB = 01:10 UTC next day
    expect(dt.toISOString()).toBe("2026-04-21T01:10:00.000Z");
  });
  it("falls back to sport default when no start_time", () => {
    const dt = estimateSettleTime("2026-04-19", "nba", null);
    // NBA default 22 ET on 2026-04-19 = 02:00 UTC next day (EDT = UTC-4)
    expect(dt.toISOString()).toBe("2026-04-20T02:00:00.000Z");
  });
});

describe("assignToWave", () => {
  it("buckets by ET equivalent of PT wave issue times", () => {
    // W2 issue = 17 PT = 20 ET (with PDT)
    // W3 issue = 21 PT = 00 ET next day
    const settleAfternoon = new Date("2026-04-19T18:00:00Z"); // 14 ET
    const settleEvening = new Date("2026-04-20T02:00:00Z"); // 22 ET
    const settleLate = new Date("2026-04-20T06:00:00Z"); // 02 ET next
    expect(assignToWave(settleAfternoon, "2026-04-19")).toBe("W1");
    expect(assignToWave(settleEvening, "2026-04-19")).toBe("W2");
    expect(assignToWave(settleLate, "2026-04-19")).toBe("W3");
  });
});

describe("waveIssueTime", () => {
  it("returns issue time in user TZ (PT default)", () => {
    const w1 = waveIssueTime("2026-04-20", "W1");
    // 9 PT in PDT = 16 UTC
    expect(w1.toISOString()).toBe("2026-04-20T16:00:00.000Z");
  });
});

describe("buildPickFromRow", () => {
  it("filters out props", () => {
    const result = buildPickFromRow({
      pick_id: 1, sport: "nba", strategy: "nba_player_points_prop",
      game_id: "g1", bet_side: "over", edge: 0.1, book_line: 22.5,
      book_odds: -110, game_date: "2026-04-19",
      one_liner: null, ew_tier: null,
      home_team_id: "LAL", away_team_id: "BOS",
      game_start_time_utc: null,
    });
    expect(result).toBeNull();
  });
  it("builds a curated pick", () => {
    const result = buildPickFromRow({
      pick_id: 1, sport: "nba", strategy: "nba_spread",
      game_id: "g1", bet_side: "home", edge: 0.1, book_line: -2.5,
      book_odds: -110, game_date: "2026-04-19",
      one_liner: "test rationale", ew_tier: "BET",
      home_team_id: "LAL", away_team_id: "BOS",
      game_start_time_utc: null,
    });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("HIGH");
    expect(result!.rationale).toBe("test rationale");
    expect(result!.rationale_tier).toBe("BET");
  });
});

describe("buildDailyPlan", () => {
  it("returns 3 empty waves when no picks", () => {
    const plan = buildDailyPlan({ planDate: "2026-04-19", picks: [] });
    expect(plan.waves).toHaveLength(3);
    expect(plan.waves.every((w) => w.picks.length === 0)).toBe(true);
    expect(plan.waves.every((w) => w.stake_per_pick === 0)).toBe(true);
  });

  it("buckets picks into waves by settle", () => {
    const picks = [
      makePick({ pick_id: 1, game_id: "g1", estimated_settle_iso: "2026-04-19T18:00:00Z" }), // W1
      makePick({ pick_id: 2, game_id: "g2", estimated_settle_iso: "2026-04-20T02:00:00Z" }), // W2
      makePick({ pick_id: 3, game_id: "g3", estimated_settle_iso: "2026-04-20T06:00:00Z" }), // W3
    ];
    const plan = buildDailyPlan({ planDate: "2026-04-19", picks });
    const byWave = Object.fromEntries(plan.waves.map((w) => [w.wave_id, w]));
    expect(byWave.W1.picks.map((p) => p.pick_id)).toEqual([1]);
    expect(byWave.W2.picks.map((p) => p.pick_id)).toEqual([2]);
    expect(byWave.W3.picks.map((p) => p.pick_id)).toEqual([3]);
  });

  it("enforces max 1 pick per game (concentration cap)", () => {
    const picks = [
      makePick({ pick_id: 1, game_id: "g1", strategy: "mlb_run_line",
                 estimated_settle_iso: "2026-04-20T02:00:00Z", edge: 0.5 }),
      makePick({ pick_id: 2, game_id: "g1", strategy: "mlb_f5_ml",
                 estimated_settle_iso: "2026-04-20T02:00:00Z", edge: 0.5 }), // SAME GAME
      makePick({ pick_id: 3, game_id: "g2", strategy: "nba_ml",
                 estimated_settle_iso: "2026-04-20T02:00:00Z", edge: 0.3 }),
    ];
    const plan = buildDailyPlan({ planDate: "2026-04-19", picks, maxPicksPerWave: 2 });
    const w2 = plan.waves.find((w) => w.wave_id === "W2")!;
    const gameIds = new Set(w2.picks.map((p) => p.game_id));
    expect(gameIds.size).toBe(w2.picks.length); // no duplicate games
    expect(w2.picks.length).toBe(2);
  });

  it("flags suspect-edge picks in notes", () => {
    const picks = [
      makePick({ pick_id: 1, edge: 0.4, estimated_settle_iso: "2026-04-20T02:00:00Z" }),
    ];
    const plan = buildDailyPlan({ planDate: "2026-04-19", picks });
    const w2 = plan.waves.find((w) => w.wave_id === "W2")!;
    expect(w2.notes).toContain("WARN");
    expect(w2.notes).toContain("verify line freshness");
  });

  it("caps single-pick stake at MAX_PICK_BANKROLL_FRACTION", () => {
    const picks = [makePick({ estimated_settle_iso: "2026-04-20T02:00:00Z" })];
    const plan = buildDailyPlan({
      planDate: "2026-04-19", picks,
      startingBankroll: 200, currentBankroll: 200,
    });
    const w2 = plan.waves.find((w) => w.wave_id === "W2")!;
    expect(w2.picks).toHaveLength(1);
    expect(w2.stake_per_pick).toBe(200 * MAX_PICK_BANKROLL_FRACTION);
  });

  it("flat-splits when 2 picks (cap doesn't bite)", () => {
    const picks = [
      makePick({ pick_id: 1, game_id: "g1", estimated_settle_iso: "2026-04-20T02:00:00Z" }),
      makePick({ pick_id: 2, game_id: "g2", estimated_settle_iso: "2026-04-20T02:00:00Z" }),
    ];
    const plan = buildDailyPlan({
      planDate: "2026-04-19", picks,
      startingBankroll: 200, currentBankroll: 200,
    });
    const w2 = plan.waves.find((w) => w.wave_id === "W2")!;
    expect(w2.stake_per_pick).toBe(100); // flat split, below cap
  });

  it("D4 fallback: shows best LOW pick with warning when no HIGH/MED", () => {
    const picks = [
      makePick({ edge: 0.02, estimated_settle_iso: "2026-04-20T02:00:00Z" }),
    ];
    const plan = buildDailyPlan({ planDate: "2026-04-19", picks });
    const w2 = plan.waves.find((w) => w.wave_id === "W2")!;
    expect(w2.picks).toHaveLength(1);
    expect(w2.picks[0].confidence).toBe("LOW");
    expect(w2.notes).toContain("below threshold");
  });

  it("HIGH+MED preferred over LOW", () => {
    const picks = [
      makePick({ pick_id: 1, game_id: "g1", edge: 0.02, estimated_settle_iso: "2026-04-20T02:00:00Z" }),
      makePick({ pick_id: 2, game_id: "g2", edge: 0.10, estimated_settle_iso: "2026-04-20T02:00:00Z" }),
      makePick({ pick_id: 3, game_id: "g3", edge: 0.05, estimated_settle_iso: "2026-04-20T02:00:00Z" }),
    ];
    const plan = buildDailyPlan({ planDate: "2026-04-19", picks, maxPicksPerWave: 2 });
    const w2 = plan.waves.find((w) => w.wave_id === "W2")!;
    expect(new Set(w2.picks.map((p) => p.pick_id))).toEqual(new Set([2, 3]));
  });
});
