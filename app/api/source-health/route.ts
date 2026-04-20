import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Returns per-chain × per-source success rate over the last 24h.
 * Reads the source_health_log table populated by src/data_sources/health.py.
 *
 * Degraded if success_rate < 0.5 over >= 3 calls.
 */
export async function GET() {
  try {
    // Ensure table exists (in case initial sync hasn't run)
    await query(`
      CREATE TABLE IF NOT EXISTS source_health_log (
        id           SERIAL PRIMARY KEY,
        chain_label  TEXT NOT NULL,
        source_name  TEXT NOT NULL,
        success      INTEGER NOT NULL,
        error        TEXT,
        called_at    TEXT NOT NULL
      )
    `);

    const rows = await query<{
      chain_label: string;
      source_name: string;
      n: number;
      wins: number;
      last_success: string | null;
    }>(`
      SELECT chain_label,
             source_name,
             COUNT(*)::int AS n,
             SUM(success)::int AS wins,
             MAX(CASE WHEN success = 1 THEN called_at END) AS last_success
        FROM source_health_log
       WHERE called_at >= (NOW() - INTERVAL '24 hours')::text
       GROUP BY chain_label, source_name
       ORDER BY chain_label, source_name
    `);

    const out = rows.map((r) => ({
      chain: r.chain_label,
      source: r.source_name,
      calls: Number(r.n),
      successes: Number(r.wins || 0),
      success_rate: Number(r.wins || 0) / Math.max(Number(r.n), 1),
      last_success: r.last_success,
      degraded: Number(r.n) >= 3 && (Number(r.wins || 0) / Number(r.n)) < 0.5,
    }));

    return NextResponse.json(
      { rows: out, generated_at: new Date().toISOString() },
      { headers: { "Cache-Control": "max-age=60, stale-while-revalidate=300" } },
    );
  } catch (e) {
    return NextResponse.json(
      { rows: [], error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    );
  }
}
