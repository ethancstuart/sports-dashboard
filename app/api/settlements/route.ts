import { NextResponse } from "next/server";
import { getRecentSettlements } from "@/lib/queries";

export async function GET() {
  try {
    const settlements = await getRecentSettlements(20);
    return NextResponse.json(settlements, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("GET /api/settlements error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settlements" },
      { status: 500 }
    );
  }
}
