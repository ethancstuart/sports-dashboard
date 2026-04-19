import { type NextRequest, NextResponse } from "next/server";
import { getActionablePicks } from "@/lib/queries";


// Force dynamic rendering — this route hits Neon Postgres at request time;
// without force-dynamic, Next.js tries to statically render at build and fails
// on preview branches that don't have DATABASE_URL set.
export const dynamic = 'force-dynamic';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    if (!date || !DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "Missing required parameter: date" },
        { status: 400 }
      );
    }
    const picks = await getActionablePicks(date);
    return NextResponse.json(picks, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("GET /api/picks error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch picks" },
      { status: 500 }
    );
  }
}
