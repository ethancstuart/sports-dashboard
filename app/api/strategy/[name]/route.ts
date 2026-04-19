import { type NextRequest, NextResponse } from "next/server";
import { getStrategyDetail } from "@/lib/queries";

// Force dynamic rendering — this route hits Neon Postgres at request time;
// without force-dynamic, Next.js tries to statically render at build and fails
// on preview branches that don't have DATABASE_URL set.
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const picks = await getStrategyDetail(name);
    return NextResponse.json(picks);
  } catch (error) {
    console.error("GET /api/strategy/[name] error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch strategy detail" },
      { status: 500 }
    );
  }
}
