import { NextResponse } from "next/server";
import { getPortfolioSummary, getLastSync } from "@/lib/queries";


// Force dynamic rendering — this route hits Neon Postgres at request time;
// without force-dynamic, Next.js tries to statically render at build and fails
// on preview branches that don't have DATABASE_URL set.
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const [summary, lastSync] = await Promise.all([
      getPortfolioSummary(),
      getLastSync(),
    ]);
    return NextResponse.json({ ...summary, last_sync: lastSync }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("GET /api/summary error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch portfolio summary" },
      { status: 500 }
    );
  }
}
