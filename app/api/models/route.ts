import { NextResponse } from "next/server";
import { getModels } from "@/lib/queries";


// Force dynamic rendering — this route hits Neon Postgres at request time;
// without force-dynamic, Next.js tries to statically render at build and fails
// on preview branches that don't have DATABASE_URL set.
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const models = await getModels();
    return NextResponse.json(models);
  } catch (error) {
    console.error("GET /api/models error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch model registry" },
      { status: 500 }
    );
  }
}
