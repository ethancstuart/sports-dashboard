import { NextResponse } from "next/server";
import { getDataStats, getDataFreshness } from "@/lib/queries";

export async function GET() {
  try {
    const [stats, freshness] = await Promise.all([
      getDataStats(),
      getDataFreshness(),
    ]);
    return NextResponse.json({ stats, freshness });
  } catch (error) {
    console.error("GET /api/data/stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data stats" },
      { status: 500 }
    );
  }
}
