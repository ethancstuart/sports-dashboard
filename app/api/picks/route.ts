import { type NextRequest, NextResponse } from "next/server";
import { getPicksByDate } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    if (!date) {
      return NextResponse.json(
        { error: "Missing required parameter: date" },
        { status: 400 }
      );
    }
    const picks = await getPicksByDate(date);
    return NextResponse.json(picks);
  } catch (error) {
    console.error("GET /api/picks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch picks" },
      { status: 500 }
    );
  }
}
