import { NextResponse } from "next/server";
import { getShadowResults } from "@/lib/queries";

export async function GET() {
  try {
    const results = await getShadowResults();
    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/shadow error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shadow results" },
      { status: 500 }
    );
  }
}
