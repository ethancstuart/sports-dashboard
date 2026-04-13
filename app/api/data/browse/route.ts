import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Table browser endpoint.
 * GET /api/data/browse?table=games&limit=50&offset=0
 * GET /api/data/browse (no table → returns list of all tables + schemas)
 */

const ALLOWED_TABLES = [
  "games",
  "strategy_picks",
  "predictions",
  "subgame_predictions",
  "elo_ratings",
  "odds",
  "nfl_quarter_scores",
  "nba_quarter_scores",
  "pipeline_artifacts",
  "alerts",
  "shadow_predictions",
];

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");

    // No table specified → return schema overview
    if (!table) {
      const tables = await query<{
        table_name: string;
        row_count: string;
      }>(`
        SELECT schemaname || '.' || relname AS table_name,
               n_live_tup::text AS row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `);

      // Get columns for each known table
      const schemas: Record<string, ColumnInfo[]> = {};
      for (const t of ALLOWED_TABLES) {
        try {
          const cols = await query<ColumnInfo>(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
          `, [t]);
          if (cols.length > 0) schemas[t] = cols;
        } catch {
          // table may not exist
        }
      }

      return NextResponse.json({ tables, schemas });
    }

    // Validate table name (prevent SQL injection)
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json(
        { error: `Table '${table}' not allowed. Allowed: ${ALLOWED_TABLES.join(", ")}` },
        { status: 403 }
      );
    }

    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 500);
    const offset = parseInt(searchParams.get("offset") ?? "0");
    const orderBy = searchParams.get("order") ?? "";
    const sport = searchParams.get("sport") ?? "";

    // Get column info
    const columns = await query<ColumnInfo>(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    // Get total count
    const countResult = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM ${table}`);
    const totalRows = parseInt(countResult[0]?.count ?? "0");

    // Build query with optional sport filter
    let where = "";
    const params: unknown[] = [];
    const hasSpotColumn = columns.some((c) => c.column_name === "sport");
    if (sport && hasSpotColumn) {
      params.push(sport);
      where = `WHERE sport = $1`;
    }

    // Order by most recent first
    const dateCol = columns.find(
      (c) =>
        c.column_name === "game_date" ||
        c.column_name === "predicted_at" ||
        c.column_name === "settled_at" ||
        c.column_name === "created_at" ||
        c.column_name === "as_of_date"
    );
    const order = orderBy || (dateCol ? `${dateCol.column_name} DESC` : "1 DESC");

    const rows = await query(
      `SELECT * FROM ${table} ${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`
      , params
    );

    return NextResponse.json({
      table,
      columns,
      rows,
      totalRows,
      limit,
      offset,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Browse failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
