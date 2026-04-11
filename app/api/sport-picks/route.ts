import { type NextRequest, NextResponse } from "next/server";
import { getPicksBySport, getStrategyPerformanceBySport } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    const sport = request.nextUrl.searchParams.get("sport");
    if (!date || !sport) {
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
    console.error("GET /api/sport-picks error:", error);
    return NextResponse.json({ error: "Failed to fetch sport picks" }, { status: 500 });
  }
}
