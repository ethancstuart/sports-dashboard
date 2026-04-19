import { type NextRequest, NextResponse } from "next/server";
import { getGameAudit } from "@/lib/queries";

// Force dynamic rendering — this route hits Neon Postgres at request time;
// without force-dynamic, Next.js tries to statically render at build and fails
// on preview branches that don't have DATABASE_URL set.
export const dynamic = 'force-dynamic';

// gameId format: alphanumeric + hyphens + underscores, 1-64 chars
const GAME_ID_RE = /^[\w-]{1,64}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;

    if (!GAME_ID_RE.test(gameId)) {
      return NextResponse.json(
        { error: "Invalid gameId format" },
        { status: 400 }
      );
    }

    const audit = await getGameAudit(gameId);
    return NextResponse.json(audit);
  } catch (error) {
    console.error("GET /api/audit/[gameId] error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch game audit" },
      { status: 500 }
    );
  }
}
