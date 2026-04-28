import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANALYZE_API_URL = process.env.ANALYZE_API_URL || "";
const ANALYZE_API_KEY = process.env.ANALYZE_API_KEY || "";

function authHeaders(): Record<string, string> {
  return ANALYZE_API_KEY ? { Authorization: `Bearer ${ANALYZE_API_KEY}` } : {};
}

export async function GET(req: NextRequest) {
  if (!ANALYZE_API_URL) {
    return NextResponse.json(
      { specs: [], error: "ANALYZE_API_URL not configured" },
      { status: 200 }
    );
  }
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  for (const k of ["status", "sport"]) {
    const v = searchParams.get(k);
    if (v) params.set(k, v);
  }
  try {
    const url = `${ANALYZE_API_URL}/api/model_specs${
      params.toString() ? `?${params}` : ""
    }`;
    const res = await fetch(url, {
      headers: authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { specs: [], error: `Backend ${res.status}` },
        { status: res.status }
      );
    }
    return NextResponse.json(await res.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { specs: [], error: String(err) },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!ANALYZE_API_URL) {
    return NextResponse.json(
      { error: "ANALYZE_API_URL not configured" },
      { status: 503 }
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const res = await fetch(`${ANALYZE_API_URL}/api/model_specs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
