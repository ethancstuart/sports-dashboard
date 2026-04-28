import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANALYZE_API_URL = process.env.ANALYZE_API_URL || "";
const ANALYZE_API_KEY = process.env.ANALYZE_API_KEY || "";

function authHeaders(): Record<string, string> {
  return ANALYZE_API_KEY ? { Authorization: `Bearer ${ANALYZE_API_KEY}` } : {};
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!ANALYZE_API_URL) {
    return NextResponse.json(
      { error: "ANALYZE_API_URL not configured" },
      { status: 503 }
    );
  }
  try {
    const res = await fetch(
      `${ANALYZE_API_URL}/api/model_specs/${encodeURIComponent(name)}`,
      {
        headers: authHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }
    );
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
