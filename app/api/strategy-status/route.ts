import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<{
      strategy: string;
      status: string;
      reason: string | null;
      updated_at: string | null;
    }>(`
      SELECT strategy, status, reason, updated_at
        FROM strategy_status
       ORDER BY
         CASE status WHEN 'paused' THEN 0 WHEN 'tracking' THEN 1 ELSE 2 END,
         strategy
    `);
    return NextResponse.json(
      { rows, generated_at: new Date().toISOString() },
      { headers: { "Cache-Control": "max-age=120, stale-while-revalidate=300" } },
    );
  } catch (e) {
    return NextResponse.json(
      { rows: [], error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    );
  }
}
