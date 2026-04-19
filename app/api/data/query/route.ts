import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";


// Force dynamic rendering — this route hits Neon Postgres at request time;
// without force-dynamic, Next.js tries to statically render at build and fails
// on preview branches that don't have DATABASE_URL set.
export const dynamic = 'force-dynamic';
/**
 * SQL query endpoint for the Data Explorer.
 * Only allows SELECT statements (read-only).
 */

const MAX_ROWS = 500;

// Whitelist: only SELECT queries allowed
function isReadOnly(sql: string): boolean {
  const trimmed = sql.trim().toLowerCase();
  // Block anything that isn't a SELECT or WITH (CTE)
  if (!trimmed.startsWith("select") && !trimmed.startsWith("with")) {
    return false;
  }
  // Block dangerous keywords even inside SELECT
  const blocked = [
    /\binsert\b/i,
    /\bupdate\b/i,
    /\bdelete\b/i,
    /\bdrop\b/i,
    /\balter\b/i,
    /\bcreate\b/i,
    /\btruncate\b/i,
    /\bgrant\b/i,
    /\brevoke\b/i,
    /\bcopy\b/i,
  ];
  for (const pattern of blocked) {
    if (pattern.test(sql)) return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sql = (body.sql ?? "").trim();

    if (!sql) {
      return NextResponse.json({ error: "No SQL provided" }, { status: 400 });
    }

    if (!isReadOnly(sql)) {
      return NextResponse.json(
        { error: "Only SELECT queries are allowed" },
        { status: 403 }
      );
    }

    // Enforce LIMIT cap — user-supplied limits above MAX_ROWS are reduced
    const limitMatch = sql.match(/\blimit\s+(\d+)/i);
    let safeSql: string;
    if (limitMatch) {
      const userLimit = parseInt(limitMatch[1], 10);
      safeSql = userLimit > MAX_ROWS
        ? sql.replace(/\blimit\s+\d+/i, `LIMIT ${MAX_ROWS}`)
        : sql;
    } else {
      safeSql = `${sql} LIMIT ${MAX_ROWS}`;
    }
    const hasLimit = !!limitMatch;

    const start = Date.now();
    const rows = await query(safeSql);
    const elapsed = Date.now() - start;

    const columns = rows.length > 0 ? Object.keys(rows[0] as object) : [];

    return NextResponse.json({
      columns,
      rows,
      rowCount: rows.length,
      truncated: !hasLimit && rows.length >= MAX_ROWS,
      elapsed,
    });
  } catch (error) {
    console.error("POST /api/data/query error:", String(error));
    const msg = error instanceof Error ? error.message : "Query failed";
    // Strip connection strings from error messages
    const safeMsg = msg.replace(/postgres(ql)?:\/\/[^\s]+/gi, "[REDACTED]");
    return NextResponse.json({ error: safeMsg }, { status: 400 });
  }
}
