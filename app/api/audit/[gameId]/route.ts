import { type NextRequest, NextResponse } from "next/server";
import { getGameAudit } from "@/lib/queries";

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
