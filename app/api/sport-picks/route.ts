import { type NextRequest, NextResponse } from "next/server";
import { getPicksBySport, getStrategyPerformanceBySport } from "@/lib/queries";


// Force dynamic rendering — this route hits Neon Postgres at request time;
// without force-dynamic, Next.js tries to statically render at build and fails
// on preview branches that don't have DATABASE_URL set.
export const dynamic = 'force-dynamic';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SPORT_RE = /^[a-z]{2,5}$/;

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    const sport = request.nextUrl.searchParams.get("sport");
    if (!date || !sport || !DATE_RE.test(date) || !SPORT_RE.test(sport)) {
      return NextResponse.json(
        { error: "Missing required parameters: date, sport" },
        { status: 400 }
      );
    }
    const [picks, performance] = await Promise.all([
      getPicksBySport(date, sport),
      getStrategyPerformanceBySport(sport),
    ]);
    return NextResponse.json({ picks, performance }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("GET /api/sport-picks error:", String(error));
    return NextResponse.json({ error: "Failed to fetch sport picks" }, { status: 500 });
  }
}
