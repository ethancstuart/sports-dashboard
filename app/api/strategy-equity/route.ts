import { NextResponse } from "next/server";
import { getStrategyEquity } from "@/lib/queries";

export async function GET() {
  try {
    const equity = await getStrategyEquity();
    return NextResponse.json(equity, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("GET /api/strategy-equity error:", error);
    return NextResponse.json({ error: "Failed to fetch strategy equity" }, { status: 500 });
  }
}
