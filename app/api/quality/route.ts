import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface QualityArtifact {
  id: number;
  artifact_type: string;
  name: string;
  sport: string | null;
  data: string;
  created_at: string;
}

export async function GET() {
  try {
    const rows = await query<QualityArtifact>(
      `SELECT id, artifact_type, name, sport, data, created_at
       FROM pipeline_artifacts
       WHERE artifact_type IN ('expectation_results', 'health_report', 'retrain_metrics')
       ORDER BY created_at DESC
       LIMIT 50`
    );

    // Parse JSON data field for each artifact
    const expectations = rows.map((row) => {
      let parsed = null;
      try {
        parsed = JSON.parse(row.data);
      } catch {
        parsed = row.data;
      }
      return {
        id: row.id,
        artifact_type: row.artifact_type,
        name: row.name,
        sport: row.sport,
        data: parsed,
        created_at: row.created_at,
      };
    });

    return NextResponse.json(
      { expectations },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/quality error:", String(error));
    return NextResponse.json(
      { error: "Failed to fetch quality data" },
      { status: 500 }
    );
  }
}
