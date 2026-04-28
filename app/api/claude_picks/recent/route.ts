import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANALYZE_API_URL = process.env.ANALYZE_API_URL || "";
const ANALYZE_API_KEY = process.env.ANALYZE_API_KEY || "";

export async function GET(req: NextRequest) {
  if (!ANALYZE_API_URL) {
    return NextResponse.json(
      { picks: [], summary: null, error: "ANALYZE_API_URL not configured" },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  for (const k of ["limit", "sport", "include_unsettled"]) {
    const v = searchParams.get(k);
    if (v) params.set(k, v);
  }

  try {
    const url = `${ANALYZE_API_URL}/api/claude_picks/recent${
      params.toString() ? `?${params}` : ""
    }`;
    const res = await fetch(url, {
      headers: ANALYZE_API_KEY
        ? { Authorization: `Bearer ${ANALYZE_API_KEY}` }
        : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { picks: [], summary: null, error: `Backend ${res.status}` },
        { status: res.status }
      );
    }
    return NextResponse.json(await res.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("claude_picks/recent proxy error:", err);
    return NextResponse.json(
      { picks: [], summary: null, error: String(err) },
      { status: 502 }
    );
  }
}
