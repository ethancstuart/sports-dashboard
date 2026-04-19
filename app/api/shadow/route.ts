import { NextResponse } from "next/server";
import { getShadowResults } from "@/lib/queries";


// Force dynamic rendering — this route hits Neon Postgres at request time;
// without force-dynamic, Next.js tries to statically render at build and fails
// on preview branches that don't have DATABASE_URL set.
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const results = await getShadowResults();
    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/shadow error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch shadow results" },
      { status: 500 }
    );
  }
}
