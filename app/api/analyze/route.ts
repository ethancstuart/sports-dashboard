import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function extractJson(stdout: string): unknown | null {
  // The python CLI may print log lines or progress before emitting JSON.
  // Grab the first '{' ... matching '}' block via a simple brace counter
  // (ignores braces inside strings).
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

function runAnalyze(
  query: string,
  sportHint: string | null
): Promise<{ result: AnalyzeResult | null; stdout: string; stderr: string; code: number }> {
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

    proc.stdout.on("data", (d) => {
      stdout += d.toString("utf8");
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString("utf8");
    });

    proc.on("error", (err) => {
      resolve({
        result: null,
        stdout,
        stderr: stderr + "\n" + String(err),
        code: -1,
      });
    });

    proc.on("close", (code) => {
      const parsed = extractJson(stdout) as AnalyzeResult | null;
      resolve({ result: parsed, stdout, stderr, code: code ?? 0 });
    });
  });
}

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

  const { result, stderr, code } = await runAnalyze(query, sportHint);

  if (!result) {
    // Log full error server-side; return sanitized message to client
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
  });
}
