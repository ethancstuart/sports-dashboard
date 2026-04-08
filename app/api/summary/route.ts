import { NextResponse } from "next/server";
import { getPortfolioSummary, getLastSync } from "@/lib/queries";

export async function GET() {
  try {
    const [summary, lastSync] = await Promise.all([
      getPortfolioSummary(),
      getLastSync(),
    ]);
    return NextResponse.json({ ...summary, last_sync: lastSync });
  } catch (error) {
    console.error("GET /api/summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio summary" },
      { status: 500 }
    );
  }
}
