import { query, queryOne } from "./db";

// ── Ensure indexes exist (lazy, runs once per cold start) ──
let _indexesCreated = false;
async function ensureIndexes() {
  if (_indexesCreated) return;
  _indexesCreated = true;
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_sp_game_date ON strategy_picks(game_date)",
    "CREATE INDEX IF NOT EXISTS idx_sp_strategy ON strategy_picks(strategy)",
    "CREATE INDEX IF NOT EXISTS idx_sp_result ON strategy_picks(result) WHERE result IS NULL",
    "CREATE INDEX IF NOT EXISTS idx_sp_settled ON strategy_picks(settled_at DESC) WHERE result IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_games_game_id ON games(game_id)",
    "CREATE INDEX IF NOT EXISTS idx_sp_sport ON strategy_picks(sport)",
    "CREATE INDEX IF NOT EXISTS idx_sp_game_id ON strategy_picks(game_id)",
    "CREATE INDEX IF NOT EXISTS idx_predictions_game_id ON predictions(game_id)",
    "CREATE INDEX IF NOT EXISTS idx_odds_game_id ON odds(game_id)",
  ];
  await Promise.allSettled(indexes.map((sql) => query(sql)));
}

// ── Portfolio Summary ──
export async function getPortfolioSummary() {
  await ensureIndexes();
  const totals = await queryOne<{
    total_picks: number;
    wins: number;
    losses: number;
    pushes: number;
    total_pnl: number;
  }>(`
    SELECT
      COUNT(*) as total_picks,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN result = 'push' THEN 1 ELSE 0 END) as pushes,
      COALESCE(SUM(pnl), 0) as total_pnl
    FROM strategy_picks WHERE result IS NOT NULL
  `);

  const open = await queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM strategy_picks WHERE result IS NULL
  `);

  return {
    total_picks: Number(totals?.total_picks ?? 0),
    wins: Number(totals?.wins ?? 0),
    losses: Number(totals?.losses ?? 0),
    pushes: Number(totals?.pushes ?? 0),
    total_pnl: Number(totals?.total_pnl ?? 0),
    open_bets: Number(open?.count ?? 0),
  };
}

// ── Picks by date ──
export async function getPicksByDate(date: string) {
  return query(`
    SELECT sp.*, g.home_team_id, g.away_team_id, g.home_score, g.away_score
    FROM strategy_picks sp
    LEFT JOIN games g ON sp.game_id = g.game_id
    WHERE sp.game_date = $1
    ORDER BY sp.strategy, sp.predicted_at
  `, [date]);
}

// ── Results by date ──
export async function getResultsByDate(date: string) {
  return query(`
    SELECT sp.*, g.home_team_id, g.away_team_id, g.home_score, g.away_score
    FROM strategy_picks sp
    LEFT JOIN games g ON sp.game_id = g.game_id
    WHERE sp.game_date = $1 AND sp.result IS NOT NULL
    ORDER BY sp.strategy
  `, [date]);
}

// ── P&L time series ──
export async function getPnlTimeSeries(days: number = 90) {
  return query(`
    SELECT game_date,
           SUM(pnl) as daily_pnl,
           SUM(SUM(pnl)) OVER (ORDER BY game_date) as cumulative_pnl,
           COUNT(*) as bets,
           SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins
    FROM strategy_picks
    WHERE result IS NOT NULL
    GROUP BY game_date
    ORDER BY game_date DESC
    LIMIT $1
  `, [days]);
}

// ── Strategy performance ──
export async function getStrategyPerformance() {
  return query(`
    SELECT
      strategy, sport,
      COUNT(*) as total,
      SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) as losses,
      COALESCE(SUM(pnl), 0) as total_pnl,
      AVG(CASE WHEN clv IS NOT NULL THEN clv END) as avg_clv,
      AVG(edge) as avg_edge
    FROM strategy_picks
    WHERE result IS NOT NULL
    GROUP BY strategy, sport
    ORDER BY total_pnl DESC
  `);
}

// ── Single strategy detail ──
export async function getStrategyDetail(name: string) {
  return query(`
    SELECT sp.*, g.home_team_id, g.away_team_id, g.home_score, g.away_score
    FROM strategy_picks sp
    LEFT JOIN games g ON sp.game_id = g.game_id
    WHERE sp.strategy = $1
    ORDER BY sp.game_date DESC
  `, [name]);
}

// ── Open positions ──
export async function getOpenPositions() {
  return query(`
    SELECT sp.*, g.home_team_id, g.away_team_id, g.game_date,
           g.home_score, g.away_score
    FROM strategy_picks sp
    LEFT JOIN games g ON sp.game_id = g.game_id
    WHERE sp.result IS NULL
    ORDER BY sp.game_date, sp.strategy
  `);
}

// ── Prediction audit for a game ──
export async function getGameAudit(gameId: string) {
  const picks = await query(`
    SELECT * FROM strategy_picks WHERE game_id = $1 ORDER BY strategy
  `, [gameId]);

  const predictions = await query(`
    SELECT * FROM predictions WHERE game_id = $1
  `, [gameId]);

  const subgame = await query(`
    SELECT * FROM subgame_predictions WHERE game_id = $1
  `, [gameId]);

  const game = await queryOne(`
    SELECT * FROM games WHERE game_id = $1
  `, [gameId]);

  const odds = await query(`
    SELECT * FROM odds WHERE game_id = $1
  `, [gameId]);

  return { game, picks, predictions, subgame, odds };
}

// ── Model registry ──
export async function getModels() {
  return query(`
    SELECT * FROM pipeline_artifacts WHERE artifact_type = 'model_metrics'
    ORDER BY created_at DESC
  `);
}

// ── Gate status ──
export async function getGateStatus() {
  return query(`
    SELECT
      strategy, sport,
      COUNT(*) as n,
      SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) as losses,
      COALESCE(SUM(pnl), 0) as total_pnl,
      MIN(game_date) as first_bet,
      MAX(game_date) as last_bet
    FROM strategy_picks
    WHERE result IS NOT NULL
    GROUP BY strategy, sport
    ORDER BY strategy
  `);
}

// ── Data stats ──
export async function getDataStats() {
  // Single query instead of 8 separate COUNT(*) calls — much cheaper on Neon
  const rows = await query<{ table_name: string; row_count: number }>(`
    SELECT
      schemaname || '.' || relname AS table_name,
      n_live_tup::int AS row_count
    FROM pg_stat_user_tables
    WHERE relname IN ('games','strategy_picks','predictions','subgame_predictions',
                      'elo_ratings','odds','nfl_quarter_scores','nba_quarter_scores')
    ORDER BY relname
  `);
  return rows.map((r) => ({
    table: String(r.table_name).replace("public.", ""),
    count: Number(r.row_count ?? 0),
  }));
}

// ── Alerts ──
export async function getAlerts(limit: number = 50) {
  try {
    return await query(`
      SELECT * FROM alerts ORDER BY created_at DESC LIMIT $1
    `, [limit]);
  } catch {
    return [];
  }
}

// ── Shadow predictions ──
export async function getShadowResults() {
  try {
    return await query(`
      SELECT * FROM shadow_predictions WHERE result IS NOT NULL
      ORDER BY predicted_at DESC LIMIT 200
    `);
  } catch {
    return [];
  }
}

// ── Actionable picks (today, with tier) ──
// Excludes picks the user has already placed — once marked, they go
// into /placements and shouldn't clutter the "pick something" surface.
export async function getActionablePicks(date: string) {
  return query(`
    SELECT sp.*,
           g.home_team_id, g.away_team_id, g.home_score, g.away_score,
           CASE
             WHEN sp.edge > 0.02 AND sp.kelly_size > 0.005 THEN 'ACTIONABLE'
             ELSE 'TRACKING'
           END as tier
    FROM strategy_picks sp
    LEFT JOIN games g ON sp.game_id = g.game_id
    WHERE sp.game_date = $1
      AND NOT EXISTS (
          SELECT 1 FROM placed_bets pb WHERE pb.pick_id = sp.pick_id
      )
    ORDER BY
      CASE WHEN sp.edge > 0.02 AND sp.kelly_size > 0.005 THEN 0 ELSE 1 END,
      sp.kelly_size DESC NULLS LAST,
      sp.strategy
  `, [date]);
}

// ── Recent settlements ──
export async function getRecentSettlements(limit: number = 20) {
  return query(`
    SELECT sp.*,
           g.home_team_id, g.away_team_id, g.home_score, g.away_score
    FROM strategy_picks sp
    LEFT JOIN games g ON sp.game_id = g.game_id
    WHERE sp.result IS NOT NULL
    ORDER BY sp.settled_at DESC NULLS LAST, sp.game_date DESC
    LIMIT $1
  `, [limit]);
}

// ── Strategy equity curves (cumulative P&L per strategy over time) ──
export async function getStrategyEquity() {
  return query(`
    SELECT strategy, sport, game_date,
           SUM(pnl) as daily_pnl,
           SUM(SUM(pnl)) OVER (PARTITION BY strategy ORDER BY game_date) as cumulative_pnl,
           COUNT(*) as bets,
           SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins
    FROM strategy_picks
    WHERE result IS NOT NULL
    GROUP BY strategy, sport, game_date
    ORDER BY strategy, game_date
  `);
}

// ── Similar spots: historical record at similar confidence levels ──
export async function getSimilarSpots(strategy: string, confidence: number, range: number = 0.03) {
  const lo = confidence - range;
  const hi = confidence + range;
  return queryOne<{ total: number; wins: number; losses: number; avg_pnl: number }>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) as losses,
      AVG(pnl) as avg_pnl
    FROM strategy_picks
    WHERE strategy = $1
      AND result IS NOT NULL
      AND predicted_value BETWEEN $2 AND $3
  `, [strategy, lo, hi]);
}

// ── Picks by sport for a date ──
// Excludes already-placed picks so the home page rotates through what's
// left to decide on, not what's already decided.
export async function getPicksBySport(date: string, sport: string) {
  // Exclude same-game player props from the slate (feedback 2026-04-19).
  // LEFT JOIN pick_rationales so picks without AI enrichment still render.
  return query(`
    SELECT sp.*,
           g.home_team_id, g.away_team_id, g.home_score, g.away_score,
           pr.rationale, pr.risks_json, pr.confidence,
           pr.confidence_adj, pr.one_liner, pr.ew_score, pr.ew_tier,
           CASE
             WHEN sp.edge > 0.04 AND sp.kelly_size > 0.01 THEN 'HIGH'
             WHEN sp.edge > 0.02 AND sp.kelly_size > 0.005 THEN 'MEDIUM'
             ELSE 'LOW'
           END as urgency
    FROM strategy_picks sp
    LEFT JOIN games g ON sp.game_id = g.game_id
    LEFT JOIN pick_rationales pr ON pr.pick_id = sp.pick_id
    WHERE sp.game_date = $1 AND sp.sport = $2
      AND sp.strategy NOT LIKE '%player%'
      AND NOT EXISTS (
          SELECT 1 FROM placed_bets pb WHERE pb.pick_id = sp.pick_id
      )
    ORDER BY
      pr.ew_score DESC NULLS LAST,
      CASE
        WHEN sp.edge > 0.04 AND sp.kelly_size > 0.01 THEN 0
        WHEN sp.edge > 0.02 AND sp.kelly_size > 0.005 THEN 1
        ELSE 2
      END,
      sp.kelly_size DESC NULLS LAST,
      sp.strategy
  `, [date, sport]);
}

// ── Strategy performance by sport ──
export async function getStrategyPerformanceBySport(sport: string) {
  return query(`
    SELECT
      strategy,
      COUNT(*) as total,
      SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) as losses,
      COALESCE(SUM(pnl), 0) as total_pnl,
      AVG(edge) as avg_edge,
      AVG(CASE WHEN clv IS NOT NULL THEN clv END) as avg_clv
    FROM strategy_picks
    WHERE result IS NOT NULL AND sport = $1
    GROUP BY strategy
    ORDER BY total_pnl DESC
  `, [sport]);
}

// ── Last sync time ──
export async function getLastSync() {
  try {
    const row = await queryOne<{ synced_at: string }>(`
      SELECT synced_at FROM sync_log ORDER BY synced_at DESC LIMIT 1
    `);
    return row?.synced_at ?? null;
  } catch {
    return null;
  }
}

// ── Data freshness by sport ──
export async function getDataFreshness() {
  return query(`
    SELECT sport,
           MAX(game_date) as latest_game,
           COUNT(*) as total_games,
           SUM(CASE WHEN home_score IS NOT NULL THEN 1 ELSE 0 END) as completed
    FROM games
    GROUP BY sport
  `);
}

// ── Governance: ingestion log ──
export async function getIngestionLog(limit: number = 50) {
  try {
    return await query(`
      SELECT sport, source, data_type, season, records_fetched, records_stored,
             status, notes, started_at, created_at
      FROM ingestion_log
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
  } catch {
    return [];
  }
}

// ── Governance: retrain metrics from pipeline_artifacts ──
export async function getRetrainMetrics(limit: number = 10) {
  try {
    return await query(`
      SELECT name, sport, data, created_at
      FROM pipeline_artifacts
      WHERE artifact_type = 'retrain_metrics'
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
  } catch {
    return [];
  }
}

// ── Daily Play: today's curated picks for the wave sequencer ──
// Mirrors getPicksBySport but cross-sport. Drops props at SQL level so the
// TS sequencer's curated-market filter is a belt-and-suspenders second pass.
export async function getDailyPlanPicks(date: string) {
  return query(`
    SELECT sp.pick_id, sp.sport, sp.strategy, sp.game_id, sp.bet_side,
           sp.edge, sp.book_line, COALESCE(sp.book_odds, -110) AS book_odds,
           sp.game_date,
           pr.one_liner, pr.ew_tier,
           g.home_team_id, g.away_team_id
      FROM strategy_picks sp
      LEFT JOIN games g ON sp.game_id = g.game_id
      LEFT JOIN pick_rationales pr ON pr.pick_id = sp.pick_id
     WHERE sp.game_date = $1
       AND sp.result IS NULL
       AND sp.edge IS NOT NULL
       AND sp.strategy NOT LIKE '%player%'
       AND sp.strategy NOT LIKE '%prop%'
  `, [date]);
}

// ── Daily Play: realized PnL today (for live bankroll calc) ──
export async function getRealizedPnlUnits(date: string) {
  const row = await queryOne<{ total: number }>(`
    SELECT COALESCE(SUM(pnl), 0)::float AS total
      FROM strategy_picks
     WHERE game_date = $1
       AND result IS NOT NULL
       AND pnl IS NOT NULL
  `, [date]);
  return row?.total ?? 0;
}

// ── Daily Play: today's settled picks (for the "history" feed below the hero) ──
export async function getDailyPlanSettled(date: string) {
  return query(`
    SELECT sp.pick_id, sp.sport, sp.strategy, sp.game_id, sp.bet_side,
           sp.edge, sp.book_line, sp.book_odds, sp.result, sp.pnl, sp.settled_at,
           g.home_team_id, g.away_team_id
      FROM strategy_picks sp
      LEFT JOIN games g ON sp.game_id = g.game_id
     WHERE sp.game_date = $1
       AND sp.result IS NOT NULL
     ORDER BY sp.settled_at DESC NULLS LAST
  `, [date]);
}

// ── Live: today's open picks ──
export async function getTodaysOpenPicks(today: string) {
  return query(`
    SELECT sp.*, g.home_team_id, g.away_team_id, g.home_score, g.away_score
    FROM strategy_picks sp
    LEFT JOIN games g ON sp.game_id = g.game_id
    WHERE sp.result IS NULL AND sp.game_date >= $1
    ORDER BY sp.game_date, sp.sport, sp.strategy
  `, [today]);
}

// ── Model health: per-strategy diagnostic metrics (replaces P&L focus) ──
//
// For each strategy: sample size, actual WR vs break-even WR, Brier score,
// mean CLV, mean edge realization. These are the numbers that tell us if the
// model is still honest — NOT cumulative P&L.
export async function getModelHealth() {
  await ensureIndexes();
  return query(`
    SELECT
      strategy,
      sport,
      COUNT(*)::int AS n,
      SUM(CASE WHEN result='win'  THEN 1 ELSE 0 END)::int AS wins,
      SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END)::int AS losses,
      SUM(CASE WHEN result='push' THEN 1 ELSE 0 END)::int AS pushes,
      -- Hit rate excluding pushes
      AVG(CASE
        WHEN result='win'  THEN 1.0
        WHEN result='loss' THEN 0.0
        ELSE NULL
      END) AS actual_wr,
      -- Break-even WR implied by American odds
      AVG(
        CASE
          WHEN book_odds >=  100 THEN  100.0 / (book_odds + 100.0)
          WHEN book_odds <= -100 THEN (-book_odds) / ((-book_odds) + 100.0)
          ELSE 0.524
        END
      ) AS breakeven_wr,
      -- Mean model-predicted probability (confidence on bet side)
      AVG(predicted_value) AS avg_pred,
      -- Brier score: mean squared error of predicted prob vs actual outcome
      AVG(CASE
        WHEN result='win'  THEN (1 - predicted_value) * (1 - predicted_value)
        WHEN result='loss' THEN predicted_value * predicted_value
        ELSE NULL
      END) AS brier,
      AVG(CASE WHEN clv IS NOT NULL THEN clv END) AS avg_clv,
      AVG(edge) AS avg_edge,
      COALESCE(SUM(pnl), 0) AS total_pnl,
      MAX(game_date) AS last_bet
    FROM strategy_picks
    WHERE result IS NOT NULL AND predicted_value IS NOT NULL
      AND game_date >= (CURRENT_DATE - INTERVAL '180 days')::text
    GROUP BY strategy, sport
    ORDER BY n DESC
  `);
}

// ── Pipeline artifacts (health report, etc) ──
export async function getHealthReport() {
  try {
    const row = await queryOne<{ data: string }>(`
      SELECT data FROM pipeline_artifacts
      WHERE artifact_type = 'health_report'
      ORDER BY created_at DESC LIMIT 1
    `);
    return row ? JSON.parse(row.data as string) : null;
  } catch {
    return null;
  }
}

// ── Decision Ledger: the bets the user actually placed ──
// Every realized-CLV computation needs line_taken + odds_taken from
// the book the user actually used, not the pipeline's snapshot at
// pick-creation. Without this the "CLV" shown on the dashboard is
// the model's hypothetical; with this it's the bettor's bankroll truth.

export async function markPickPlaced(args: {
  pick_id: number;
  book: string;
  stake: number;
  line_taken: number | null;
  odds_taken: number | null;
  notes: string | null;
}): Promise<number> {
  const row = await queryOne<{ placement_id: number }>(
    `INSERT INTO placed_bets
       (pick_id, book, stake, line_taken, odds_taken, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING placement_id`,
    [args.pick_id, args.book, args.stake, args.line_taken, args.odds_taken, args.notes],
  );
  if (!row) {
    throw new Error("INSERT into placed_bets did not return a placement_id");
  }
  return row.placement_id;
}

export async function listRecentPlacements(limit: number = 50) {
  return query(
    `SELECT pb.placement_id, pb.pick_id, pb.placed_at, pb.book,
            pb.line_taken, pb.odds_taken, pb.stake, pb.notes,
            pb.settled_result, pb.realized_pnl, pb.realized_clv,
            sp.strategy, sp.bet_side, sp.game_date, sp.book_odds,
            sp.edge, sp.result, sp.clv,
            g.home_team_id, g.away_team_id
     FROM placed_bets pb
     JOIN strategy_picks sp ON sp.pick_id = pb.pick_id
     LEFT JOIN games g ON g.game_id = sp.game_id
     ORDER BY pb.placed_at DESC
     LIMIT $1`,
    [limit],
  );
}
