"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, Sparkles, Zap } from "lucide-react";

/* ---------- types ---------- */

interface AnalyzeContext {
  home_elo?: number | null;
  away_elo?: number | null;
  home_recent?: string | null;
  away_recent?: string | null;
  h2h?: string | null;
  similar_bets_wr?: number | null;
  [key: string]: unknown;
}

interface AnalyzeResult {
  query: string;
  parsed: {
    sport?: string | null;
    home_team?: string | null;
    away_team?: string | null;
    bet_type?: string | null;
    side?: string | null;
    line?: number | null;
    [key: string]: unknown;
  };
  recommendation: "BET" | "PASS" | "FADE" | string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | string;
  edge: number;
  model_prob: number;
  implied_prob: number;
  kelly_fraction: number;
  reasoning: string[];
  warnings: string[];
  context: AnalyzeContext;
}

interface AnalyzeError {
  error: string;
  stderr?: string;
  stdout?: string;
  code?: number;
}

/* ---------- constants ---------- */

const EXAMPLES: string[] = [
  "Lakers ML vs Warriors",
  "Yankees vs Red Sox moneyline",
  "Alabama -14 vs Auburn",
  "Over 8.5 runs Dodgers vs Padres",
  "Bills ML vs Chiefs",
];

const SPORTS: { value: string; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "nba", label: "NBA" },
  { value: "mlb", label: "MLB" },
  { value: "nfl", label: "NFL" },
  { value: "ncaaf", label: "CFB" },
];

/* ---------- helpers ---------- */

function recColor(rec: string): string {
  const r = (rec || "").toUpperCase();
  if (r === "BET")
    return "bg-[var(--win)]/20 text-[var(--win)] border-[var(--win)]/40";
  if (r === "FADE")
    return "bg-[var(--loss)]/20 text-[var(--loss)] border-[var(--loss)]/40";
  return "bg-yellow-500/15 text-yellow-400 border-yellow-500/40";
}

function confColor(conf: string): string {
  const c = (conf || "").toUpperCase();
  if (c === "HIGH") return "text-[var(--win)]";
  if (c === "MEDIUM") return "text-yellow-400";
  return "text-muted-foreground";
}

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

function fmtNum(
  v: number | null | undefined,
  digits = 2
): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toFixed(digits);
}

function metricValueColor(edge: number): string {
  if (edge > 0.03) return "text-[var(--win)]";
  if (edge < -0.01) return "text-[var(--loss)]";
  return "text-foreground";
}

/* ---------- page ---------- */

export default function AnalyzePage() {
  const [query, setQuery] = useState<string>("");
  const [sport, setSport] = useState<string>("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<AnalyzeError | null>(null);

  async function runAnalysis(q: string, sportHint: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          sport_hint: sportHint === "auto" ? null : sportHint,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json as AnalyzeError);
      } else {
        setResult(json as AnalyzeResult);
      }
    } catch (e) {
      setError({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runAnalysis(query, sport);
  }

  function handleExampleClick(ex: string) {
    setQuery(ex);
    runAnalysis(ex, sport);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight">
            AD-HOC BET ANALYZER
          </h1>
          <p className="text-sm text-muted-foreground">
            Query any game, get instant analysis backed by 13,695 games of data
          </p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Sparkles size={16} className="text-[var(--primary)]" />
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--primary)]">
            Agentic Engine
          </span>
        </div>
      </div>

      {/* Query form */}
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Should I bet Lakers -5.5 vs Warriors tonight?"
                className="flex-1 rounded-md border border-input bg-background/50 px-3 py-2.5 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
                disabled={loading}
              />
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                disabled={loading}
                className="rounded-md border border-input bg-background/50 px-3 py-2.5 font-mono text-xs uppercase tracking-wider outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
              >
                {SPORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                disabled={loading || !query.trim()}
                className="gap-2 font-mono uppercase tracking-wider"
              >
                <Zap size={14} />
                {loading ? "Analyzing…" : "Analyze"}
              </Button>
            </div>

            {/* Example chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Examples:
              </span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => handleExampleClick(ex)}
                  disabled={loading}
                  className="rounded-full border border-border bg-muted/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {loading && <LoadingState />}

      {/* Error */}
      {!loading && error && <ErrorState error={error} />}

      {/* Results */}
      {!loading && result && <ResultPanel result={result} />}

      {/* Empty state */}
      {!loading && !result && !error && <EmptyHint />}
    </div>
  );
}

/* ---------- subcomponents ---------- */

function LoadingState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />
          <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)] [animation-delay:150ms]" />
          <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)] [animation-delay:300ms]" />
        </div>
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Running Elo • Calibration • Regime Filter • Historical Context
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyHint() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <div className="font-mono text-sm text-muted-foreground">
          Enter a bet query above to get an instant, data-backed recommendation.
        </div>
        <div className="font-mono text-[11px] text-muted-foreground/60">
          Try natural language — moneyline, spread, total — across NBA / MLB / NFL / CFB.
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorState({ error }: { error: AnalyzeError }) {
  return (
    <Card className="border-[var(--loss)]/40">
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center gap-2 font-mono text-sm text-[var(--loss)]">
          <AlertTriangle size={16} />
          <span className="uppercase tracking-wider">Analyzer Error</span>
        </div>
        <div className="font-mono text-sm">{error.error}</div>
        {error.stderr && (
          <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-3 text-[11px] text-muted-foreground">
            {error.stderr}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  valueClassName,
  hint,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card/50 p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-xl font-bold tabular-nums",
          valueClassName
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
          {hint}
        </div>
      )}
    </div>
  );
}

function ResultPanel({ result }: { result: AnalyzeResult }) {
  const rec = (result.recommendation || "").toUpperCase();
  const conf = (result.confidence || "").toUpperCase();
  const ctx = result.context || {};
  const parsed = result.parsed || {};

  return (
    <div className="space-y-4">
      {/* Recommendation header */}
      <Card className="border-border">
        <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={cn(
                "h-8 rounded-md px-3 font-mono text-sm font-bold tracking-widest",
                recColor(rec)
              )}
            >
              {rec || "—"}
            </Badge>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Confidence
              </span>
              <span
                className={cn(
                  "font-mono text-sm font-bold tracking-wider",
                  confColor(conf)
                )}
              >
                {conf || "—"}
              </span>
            </div>
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            Query: <span className="text-foreground">{result.query}</span>
          </div>
        </CardContent>
      </Card>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricTile
          label="Edge"
          value={fmtPct(result.edge)}
          valueClassName={metricValueColor(result.edge ?? 0)}
          hint="Model − Implied"
        />
        <MetricTile
          label="Model Prob"
          value={fmtPct(result.model_prob)}
          hint="Calibrated"
        />
        <MetricTile
          label="Implied Prob"
          value={fmtPct(result.implied_prob)}
          hint="From market odds"
        />
        <MetricTile
          label="Kelly Fraction"
          value={fmtPct(result.kelly_fraction, 2)}
          hint="Recommended size"
        />
      </div>

      {/* Reasoning + Warnings */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <h3 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reasoning
            </h3>
            {result.reasoning && result.reasoning.length > 0 ? (
              <ul className="space-y-1.5">
                {result.reasoning.map((r, i) => (
                  <li
                    key={i}
                    className="flex gap-2 font-mono text-[13px] leading-snug"
                  >
                    <span className="mt-0.5 text-[var(--primary)]">›</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="font-mono text-sm text-muted-foreground">
                No reasoning provided.
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className={cn(
            result.warnings && result.warnings.length > 0
              ? "border-yellow-500/40"
              : ""
          )}
        >
          <CardContent className="py-4">
            <h3 className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle size={12} className="text-yellow-400" />
              Warnings
            </h3>
            {result.warnings && result.warnings.length > 0 ? (
              <ul className="space-y-1.5">
                {result.warnings.map((w, i) => (
                  <li
                    key={i}
                    className="flex gap-2 font-mono text-[13px] leading-snug text-yellow-400"
                  >
                    <span className="mt-0.5">!</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="font-mono text-sm text-muted-foreground">
                No warnings.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Context panel */}
      <Card>
        <CardContent className="py-4">
          <h3 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Context
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <ContextTile
              label="Home Elo"
              value={fmtNum(ctx.home_elo as number | null | undefined, 0)}
            />
            <ContextTile
              label="Away Elo"
              value={fmtNum(ctx.away_elo as number | null | undefined, 0)}
            />
            <ContextTile
              label="Home Recent"
              value={(ctx.home_recent as string) ?? "—"}
            />
            <ContextTile
              label="Away Recent"
              value={(ctx.away_recent as string) ?? "—"}
            />
            <ContextTile
              label="H2H"
              value={(ctx.h2h as string) ?? "—"}
            />
            <ContextTile
              label="Similar Bets WR"
              value={fmtPct(
                ctx.similar_bets_wr as number | null | undefined,
                1
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Parsed query (debug) */}
      <Card className="bg-card/40">
        <CardContent className="py-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Parsed Query (debug)
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[11px]">
            {Object.entries(parsed).map(([k, v]) => (
              <span
                key={k}
                className="rounded border border-border bg-muted/40 px-2 py-0.5"
              >
                <span className="text-muted-foreground">{k}:</span>{" "}
                <span className="text-foreground">
                  {v == null || v === "" ? "—" : String(v)}
                </span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ContextTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/50 p-2.5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}
