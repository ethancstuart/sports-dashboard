import { NextResponse } from "next/server";
import { getAlerts } from "@/lib/queries";

export async function GET() {
  try {
    const alerts = await getAlerts();
    return NextResponse.json(alerts);
  } catch (error) {
    console.error("GET /api/alerts error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}
