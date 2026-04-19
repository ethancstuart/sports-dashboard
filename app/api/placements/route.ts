import { type NextRequest, NextResponse } from "next/server";
import { markPickPlaced, listRecentPlacements } from "@/lib/queries";


// Force dynamic rendering — this route hits Neon Postgres at request time;
// without force-dynamic, Next.js tries to statically render at build and fails
// on preview branches that don't have DATABASE_URL set.
export const dynamic = 'force-dynamic';
/**
 * Decision Ledger API.
 *
 * GET  /api/placements         → recent placed_bets rows joined to picks
 * POST /api/placements         → record a new placement
 *
 * Body shape for POST:
 *   {
 *     pick_id: number,        // required — FK to strategy_picks
 *     book: string,           // required — 'draftkings', 'fanduel', etc.
 *     stake: number,          // required — dollar amount wagered
 *     line_taken?: number,    // optional — spread/total line captured
 *     odds_taken?: number,    // optional — American odds at placement
 *     notes?: string          // optional — free-text
 *   }
 *
 * Without this ledger, realized CLV is unmeasurable; only the model's
 * hypothetical CLV is trackable. The audit flagged this as the single
 * biggest trust gap between a "model dashboard" and a bettor-grade
 * product.
 */

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 200) : 50;
    const rows = await listRecentPlacements(limit);
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/placements error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch placements" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pick_id = Number(body.pick_id);
    const book = typeof body.book === "string" ? body.book.trim().toLowerCase() : "";
    const stake = Number(body.stake);
    if (!Number.isFinite(pick_id) || pick_id <= 0) {
      return NextResponse.json({ error: "pick_id must be a positive integer" }, { status: 400 });
    }
    if (!book) {
      return NextResponse.json({ error: "book is required" }, { status: 400 });
    }
    if (!Number.isFinite(stake) || stake <= 0) {
      return NextResponse.json({ error: "stake must be a positive number" }, { status: 400 });
    }
    const line_taken = body.line_taken === undefined || body.line_taken === null
      ? null
      : Number(body.line_taken);
    const odds_taken = body.odds_taken === undefined || body.odds_taken === null
      ? null
      : Number(body.odds_taken);
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : null;

    const placement_id = await markPickPlaced({
      pick_id,
      book,
      stake,
      line_taken,
      odds_taken,
      notes,
    });
    return NextResponse.json({ placement_id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/placements error:", String(error));
    return NextResponse.json(
      { error: "Failed to record placement" },
      { status: 500 }
    );
  }
}
