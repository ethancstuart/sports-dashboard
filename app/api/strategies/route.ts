import { NextResponse } from "next/server";
import { getStrategyPerformance } from "@/lib/queries";


// Force dynamic rendering — this route hits Neon Postgres at request time;
// without force-dynamic, Next.js tries to statically render at build and fails
// on preview branches that don't have DATABASE_URL set.
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const strategies = await getStrategyPerformance();
    return NextResponse.json(strategies, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("GET /api/strategies error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch strategy performance" },
      { status: 500 }
    );
  }
}
