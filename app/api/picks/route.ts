import { type NextRequest, NextResponse } from "next/server";
import { getActionablePicks } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    if (!date) {
      return NextResponse.json(
        { error: "Missing required parameter: date" },
        { status: 400 }
      );
    }
    const picks = await getActionablePicks(date);
    return NextResponse.json(picks, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("GET /api/picks error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch picks" },
      { status: 500 }
    );
  }
}
