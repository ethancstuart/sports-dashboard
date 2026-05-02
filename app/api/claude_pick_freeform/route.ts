import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hosted Flask backend on Fly.io. Same env vars as /api/claude_pick.
const ANALYZE_API_URL = process.env.ANALYZE_API_URL || "";
const ANALYZE_API_KEY = process.env.ANALYZE_API_KEY || "";

const ALLOWED_EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);

type FreeformBody = {
  sport?: string;
  away_team?: string;
  home_team?: string;
  market?: string;
  line?: number | string | null;
  odds?: number | string | null;
  side?: string | null;
  game_date?: string | null;
  notes?: string | null;
  effort?: string;
};

interface FreeformResult {
  pick_id: number;
  sport: string;
  game_id: string;
  is_freeform: boolean;
  matched_existing_game: boolean;
  freeform_away: string | null;
  freeform_home: string | null;
  market: string;
  book_line: number | null;
  book_odds: number | null;
  bet_side: string;
  confidence: string;
  estimated_edge_pct: number;
  reasoning: string;
  key_factors: string[];
  risk_flags: string[];
  usage: Record<string, number>;
  model: string;
  prompt_version: string;
}

export async function POST(req: NextRequest) {
  let body: FreeformBody;
  try {
    body = (await req.json()) as FreeformBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sport = (body.sport ?? "").toString().trim().toLowerCase();
  const away_team = (body.away_team ?? "").toString().trim();
  const home_team = (body.home_team ?? "").toString().trim();
  const market = (body.market ?? "").toString().trim();
  const side = body.side ? body.side.toString().trim() : null;
  const game_date = body.game_date ? body.game_date.toString().trim() : null;
  const notes = body.notes ? body.notes.toString() : null;
  const effort = (body.effort ?? "high").toString().trim().toLowerCase();

  // Coerce line + odds without losing the explicit-null distinction
  let line: number | null = null;
  if (body.line !== undefined && body.line !== null && body.line !== "") {
    const n = Number(body.line);
    if (Number.isNaN(n)) {
      return NextResponse.json(
        { error: "line must be a number" },
        { status: 400 }
      );
    }
    line = n;
  }
  let odds: number | null = null;
  if (body.odds !== undefined && body.odds !== null && body.odds !== "") {
    const n = Number(body.odds);
    if (!Number.isInteger(n)) {
      return NextResponse.json(
        { error: "odds must be an integer like -110 or +145" },
        { status: 400 }
      );
    }
    odds = n;
  }

  if (!sport || !away_team || !home_team || !market) {
    return NextResponse.json(
      { error: "sport, away_team, home_team, and market are required" },
      { status: 400 }
    );
  }
  if (!ALLOWED_EFFORTS.has(effort)) {
    return NextResponse.json(
      { error: `effort must be one of ${Array.from(ALLOWED_EFFORTS).join(", ")}` },
      { status: 400 }
    );
  }

  if (!ANALYZE_API_URL) {
    return NextResponse.json(
      {
        error:
          "ANALYZE_API_URL not configured. The freeform handicapper requires " +
          "the hosted backend (calls Anthropic API).",
      },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${ANALYZE_API_URL}/api/claude_pick_freeform`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ANALYZE_API_KEY
          ? { Authorization: `Bearer ${ANALYZE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        sport,
        away_team,
        home_team,
        market,
        line,
        odds,
        side,
        game_date,
        notes,
        effort,
      }),
      // Adaptive thinking on Opus 4.7 can run 30-60s on max effort
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("claude_pick_freeform backend returned", res.status, text);
      return NextResponse.json(
        { error: `Backend returned ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const result = (await res.json()) as FreeformResult;
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("claude_pick_freeform proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach backend", detail: String(err) },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "Claude-as-handicapper (freeform mode)",
    method: "POST",
    body: {
      sport: "mlb|nba|nfl|nhl|ncaab|ncaaf",
      away_team: "team_id or free-text name",
      home_team: "team_id or free-text name",
      market: "ml|spread|total|1h_spread|first_20|...",
      line: "number or null (null for moneyline)",
      odds: "integer like -110 or +145, or null",
      side: "home|away|over|under|null (let Claude choose)",
      game_date: "YYYY-MM-DD or null (defaults to today)",
      notes: "free text — injuries, weather, anything",
      effort: "low|medium|high|xhigh|max (default: high)",
    },
    backend: ANALYZE_API_URL || "(not configured)",
  });
}
