import { NextResponse } from "next/server";
import { getRecentSettlements } from "@/lib/queries";

export async function GET() {
  try {
    const settlements = await getRecentSettlements(20);
    return NextResponse.json(settlements);
  } catch (error) {
    console.error("GET /api/settlements error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settlements" },
      { status: 500 }
    );
  }
}
