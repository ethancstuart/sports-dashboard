import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANALYZE_API_URL = process.env.ANALYZE_API_URL || "";
const ANALYZE_API_KEY = process.env.ANALYZE_API_KEY || "";

export async function GET(req: NextRequest) {
  if (!ANALYZE_API_URL) {
    return NextResponse.json({ features: [] }, { status: 200 });
  }
  const sport = new URL(req.url).searchParams.get("sport");
  const url = `${ANALYZE_API_URL}/api/feature_catalog${
    sport ? `?sport=${encodeURIComponent(sport)}` : ""
  }`;
  try {
    const res = await fetch(url, {
      headers: ANALYZE_API_KEY
        ? { Authorization: `Bearer ${ANALYZE_API_KEY}` }
        : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (err) {
    return NextResponse.json({ features: [], error: String(err) }, { status: 502 });
  }
}
