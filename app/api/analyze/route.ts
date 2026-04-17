import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hosted API URL (Fly.io / Render / local Flask)
// Falls back to local subprocess if not set.
const ANALYZE_API_URL = process.env.ANALYZE_API_URL || "";
const ANALYZE_API_KEY = process.env.ANALYZE_API_KEY || "";

// Local subprocess fallback
const PIPELINE_DIR =
  process.env.SPORTS_PIPELINE_DIR ||
  "C:/Users/ethan/Projects/sports-ml-pipeline";

const PYTHON_BIN =
  process.env.SPORTS_PIPELINE_PYTHON ||
  `${PIPELINE_DIR}/.venv/Scripts/python.exe`;

type AnalyzeBody = {
  query?: string;
  sport_hint?: string | null;
};

interface AnalyzeResult {
  query: string;
  parsed: Record<string, unknown>;
  recommendation: "BET" | "PASS" | "FADE" | string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | string;
  edge: number;
  model_prob: number;
  implied_prob: number;
  kelly_fraction: number;
  reasoning: string[];
  warnings: string[];
  context: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Hosted API path ──────────────────────────────────────────────

async function callHostedApi(
  query: string,
  sportHint: string | null
): Promise<AnalyzeResult | null> {
  const res = await fetch(`${ANALYZE_API_URL}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ANALYZE_API_KEY
        ? { Authorization: `Bearer ${ANALYZE_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({ query, sport: sportHint }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    console.error("Hosted analyzer returned", res.status);
    return null;
  }

  return (await res.json()) as AnalyzeResult;
}

// ── Local subprocess fallback ────────────────────────────────────

function extractJson(stdout: string): unknown | null {
  const start = stdout.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < stdout.length; i++) {
    const ch = stdout[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const chunk = stdout.slice(start, i + 1);
        try {
          return JSON.parse(chunk);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function runLocalAnalyze(
  query: string,
  sportHint: string | null
): Promise<{
  result: AnalyzeResult | null;
  stderr: string;
  code: number;
}> {
  // Dynamic import — only needed for local fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawn } = require("node:child_process");

  return new Promise((resolve) => {
    const args = ["-m", "src.engine", "analyze", query];
    if (sportHint) args.push("--sport", sportHint);
    args.push("--json");

    const proc = spawn(PYTHON_BIN, args, {
      cwd: PIPELINE_DIR,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });

    proc.on("error", (err: Error) => {
      resolve({
        result: null,
        stderr: stderr + "\n" + String(err),
        code: -1,
      });
    });

    proc.on("close", (code: number | null) => {
      const parsed = extractJson(stdout) as AnalyzeResult | null;
      resolve({ result: parsed, stderr, code: code ?? 0 });
    });
  });
}

// ── Route handlers ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const query = (body.query ?? "").trim().slice(0, 2000);
  if (!query) {
    return NextResponse.json(
      { error: "query is required" },
      { status: 400 }
    );
  }

  const sportHintRaw = (body.sport_hint ?? "").toString().trim().toLowerCase();
  const allowedSports = new Set(["mlb", "nba", "nfl", "ncaaf"]);
  const sportHint =
    sportHintRaw && sportHintRaw !== "auto" && allowedSports.has(sportHintRaw)
      ? sportHintRaw
      : null;

  // Try hosted API first, fall back to local subprocess
  if (ANALYZE_API_URL) {
    try {
      const result = await callHostedApi(query, sportHint);
      if (result) {
        return NextResponse.json(result, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    } catch (err) {
      console.error("Hosted API call failed, falling back to local:", err);
    }
  }

  // Local subprocess fallback
  const { result, stderr, code } = await runLocalAnalyze(query, sportHint);

  if (!result) {
    console.error("Analyze failed:", { code, stderr: stderr.slice(-500) });
    return NextResponse.json(
      {
        error: "Analyzer failed — check server logs for details",
        code,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return NextResponse.json({
    service: "ad-hoc bet analyzer",
    method: "POST",
    body: { query: "string", sport_hint: "mlb|nba|nfl|ncaaf|null" },
    backend: ANALYZE_API_URL ? "hosted" : "local",
  });
}
