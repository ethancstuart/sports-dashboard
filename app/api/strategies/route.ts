import { NextResponse } from "next/server";
import { getStrategyPerformance } from "@/lib/queries";

export async function GET() {
  try {
    const strategies = await getStrategyPerformance();
    return NextResponse.json(strategies);
  } catch (error) {
    console.error("GET /api/strategies error:", error);
    return NextResponse.json(
      { error: "Failed to fetch strategy performance" },
      { status: 500 }
    );
  }
}
