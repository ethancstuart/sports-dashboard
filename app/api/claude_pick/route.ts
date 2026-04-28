import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hosted API URL (Fly.io / Render / local Flask). Same env vars as
// /api/analyze — single backend for all sports-ml-pipeline endpoints.
const ANALYZE_API_URL = process.env.ANALYZE_API_URL || "";
const ANALYZE_API_KEY = process.env.ANALYZE_API_KEY || "";

const ALLOWED_EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);

type ClaudePickBody = {
  sport?: string;
  game_id?: string | number;
  market?: string;
  side?: string | null;
  effort?: string;
};

interface ClaudePickResult {
  pick_id: number;
  sport: string;
  game_id: string;
  market: string;
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
  let body: ClaudePickBody;
  try {
    body = (await req.json()) as ClaudePickBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const sport = (body.sport ?? "").toString().trim().toLowerCase();
  const game_id = (body.game_id ?? "").toString().trim();
  const market = (body.market ?? "").toString().trim();
  const side = body.side ? body.side.toString().trim() : null;
  const effort = (body.effort ?? "high").toString().trim().toLowerCase();

  if (!sport || !game_id || !market) {
    return NextResponse.json(
      { error: "sport, game_id, and market are required" },
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
          "ANALYZE_API_URL not configured. Claude handicapper requires the " +
          "hosted backend (no local subprocess fallback — calls Anthropic API).",
      },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${ANALYZE_API_URL}/api/claude_pick`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ANALYZE_API_KEY
          ? { Authorization: `Bearer ${ANALYZE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ sport, game_id, market, side, effort }),
      // Claude Opus calls can take 30-60s on max effort with adaptive thinking
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("claude_pick backend returned", res.status, text);
      return NextResponse.json(
        { error: `Backend returned ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const result = (await res.json()) as ClaudePickResult;
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("claude_pick proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach backend", detail: String(err) },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "Claude-as-handicapper",
    method: "POST",
    body: {
      sport: "mlb|nba|nfl|nhl|...",
      game_id: "string (from games table)",
      market: "ml|spread|total|1h_spread|first_20|...",
      side: "home|away|over|under|null",
      effort: "low|medium|high|xhigh|max (default: high)",
    },
    backend: ANALYZE_API_URL || "(not configured)",
  });
}
