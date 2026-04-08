import { type NextRequest, NextResponse } from "next/server";
import { getResultsByDate } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    if (!date) {
      return NextResponse.json(
        { error: "Missing required parameter: date" },
        { status: 400 }
      );
    }
    const results = await getResultsByDate(date);
    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/results error:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
