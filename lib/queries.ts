import { query, queryOne } from "./db";

// ── Portfolio Summary ──
export async function getPortfolioSummary() {
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

  return { ...totals, open_bets: open?.count ?? 0 };
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
  const tables = ["games", "strategy_picks", "predictions", "subgame_predictions",
                  "elo_ratings", "odds", "nfl_quarter_scores", "nba_quarter_scores"];

  const stats = [];
  for (const table of tables) {
    try {
      const row = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
      stats.push({ table, count: row?.count ?? 0 });
    } catch {
      stats.push({ table, count: 0 });
    }
  }
  return stats;
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
