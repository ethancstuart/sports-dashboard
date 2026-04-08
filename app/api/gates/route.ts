import { NextResponse } from "next/server";
import { getGateStatus } from "@/lib/queries";

export async function GET() {
  try {
    const gates = await getGateStatus();
    return NextResponse.json(gates);
  } catch (error) {
    console.error("GET /api/gates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch gate status" },
      { status: 500 }
    );
  }
}
