import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANALYZE_API_URL = process.env.ANALYZE_API_URL || "";
const ANALYZE_API_KEY = process.env.ANALYZE_API_KEY || "";

type PlacementBody = {
  pick_id: number;
  fill_odds: number;
  fill_stake: number;
  book: string;
  notes?: string;
};

export async function POST(req: NextRequest) {
  let body: PlacementBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.pick_id || !body.fill_odds || !body.fill_stake || !body.book) {
    return NextResponse.json(
      { error: "missing required fields" },
      { status: 400 },
    );
  }

  if (!ANALYZE_API_URL) {
    return NextResponse.json(
      { error: "ANALYZE_API_URL not configured" },
      { status: 500 },
    );
  }

  try {
    const resp = await fetch(`${ANALYZE_API_URL}/api/record_placement`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ANALYZE_API_KEY
          ? { Authorization: `Bearer ${ANALYZE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (e) {
    return NextResponse.json(
      { error: `proxy failed: ${String(e)}` },
      { status: 502 },
    );
  }
}
