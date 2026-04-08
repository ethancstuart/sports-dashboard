import { type NextRequest, NextResponse } from "next/server";
import { getPnlTimeSeries } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const daysParam = request.nextUrl.searchParams.get("days");
    const days = daysParam ? parseInt(daysParam, 10) : 90;
    const pnl = await getPnlTimeSeries(days);
    return NextResponse.json(pnl);
  } catch (error) {
    console.error("GET /api/pnl error:", error);
    return NextResponse.json(
      { error: "Failed to fetch P&L data" },
      { status: 500 }
    );
  }
}
