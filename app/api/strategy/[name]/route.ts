import { type NextRequest, NextResponse } from "next/server";
import { getStrategyDetail } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const picks = await getStrategyDetail(name);
    return NextResponse.json(picks);
  } catch (error) {
    console.error("GET /api/strategy/[name] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch strategy detail" },
      { status: 500 }
    );
  }
}
