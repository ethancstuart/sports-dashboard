import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANALYZE_API_URL = process.env.ANALYZE_API_URL || "";
const ANALYZE_API_KEY = process.env.ANALYZE_API_KEY || "";

export async function GET() {
  if (!ANALYZE_API_URL) {
    return NextResponse.json(
      { error: "ANALYZE_API_URL not configured" },
      { status: 500 },
    );
  }
  try {
    const resp = await fetch(`${ANALYZE_API_URL}/api/live_picks`, {
      headers: ANALYZE_API_KEY
        ? { Authorization: `Bearer ${ANALYZE_API_KEY}` }
        : {},
      cache: "no-store",
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (e) {
    return NextResponse.json(
      { error: `Fetch failed: ${String(e)}` },
      { status: 502 },
    );
  }
}
