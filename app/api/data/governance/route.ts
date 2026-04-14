import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  try {
    // Pipeline execution log (from ingestion_log)
    let ingestionLog: unknown[] = [];
    try {
      ingestionLog = await query(`
        SELECT sport, source, data_type, season, records_fetched, records_stored,
               status, notes, started_at, created_at
        FROM ingestion_log
        ORDER BY created_at DESC
        LIMIT 50
      `);
    } catch { /* table may not exist yet */ }

    // Settlement lag per sport (use text date comparison — both columns are TEXT)
    let settlementLag: unknown[] = [];
    try {
      settlementLag = await query(`
        SELECT sp.sport,
               AVG(
                 EXTRACT(EPOCH FROM (sp.settled_at::timestamp - (g.game_date || 'T00:00:00')::timestamp)) / 3600
               ) as avg_hours,
               MAX(
                 EXTRACT(EPOCH FROM (sp.settled_at::timestamp - (g.game_date || 'T00:00:00')::timestamp)) / 3600
               ) as max_hours,
               COUNT(*) as settled_count
        FROM strategy_picks sp
        JOIN games g ON sp.game_id = g.game_id
        WHERE sp.settled_at IS NOT NULL AND sp.result IS NOT NULL
          AND sp.game_date >= to_char(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
        GROUP BY sp.sport
      `);
    } catch { /* ignore */ }

    // Model health from pipeline_artifacts
    let modelHealth: unknown[] = [];
    try {
      modelHealth = await query(`
        SELECT name, sport, data, created_at
        FROM pipeline_artifacts
        WHERE artifact_type = 'retrain_metrics'
        ORDER BY created_at DESC
        LIMIT 10
      `);
    } catch { /* ignore */ }

    // Unsettled games count (> 24h old with final scores)
    let unsettledCount = 0;
    try {
      const row = await queryOne<{ count: number }>(`
        SELECT COUNT(*) as count FROM strategy_picks sp
        JOIN games g ON sp.game_id = g.game_id
        WHERE sp.result IS NULL AND sp.settled_at IS NULL
          AND g.home_score IS NOT NULL AND g.away_score IS NOT NULL
          AND g.game_date < to_char(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD')
      `);
      unsettledCount = row?.count ?? 0;
    } catch { /* ignore */ }

    // Recent alerts
    let alerts: unknown[] = [];
    try {
      alerts = await query(`
        SELECT severity, message, details, created_at
        FROM alerts
        ORDER BY created_at DESC
        LIMIT 30
      `);
    } catch { /* ignore */ }

    return NextResponse.json({
      ingestion_log: ingestionLog,
      settlement_lag: settlementLag,
      model_health: modelHealth,
      unsettled_count: unsettledCount,
      alerts,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Governance API error:", error);
    return NextResponse.json({ error: "Failed to fetch governance data" }, { status: 500 });
  }
}
