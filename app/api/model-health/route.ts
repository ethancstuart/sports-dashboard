import { NextResponse } from "next/server";
import { getModelHealth } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const rows = await getModelHealth();
    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("GET /api/model-health error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch model health" },
      { status: 500 }
    );
  }
}
