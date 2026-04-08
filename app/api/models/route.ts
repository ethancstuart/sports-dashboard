import { NextResponse } from "next/server";
import { getModels } from "@/lib/queries";

export async function GET() {
  try {
    const models = await getModels();
    return NextResponse.json(models);
  } catch (error) {
    console.error("GET /api/models error:", error);
    return NextResponse.json(
      { error: "Failed to fetch model registry" },
      { status: 500 }
    );
  }
}
