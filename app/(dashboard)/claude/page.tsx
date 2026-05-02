"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────── Types ───────── */

interface ClaudePickResult {
  pick_id: number;
  sport: string;
  game_id: string;
  market: string;
  bet_side: string;
  confidence: string;
  estimated_edge_pct: number;
  reasoning: string;
  key_factors: string[];
  risk_flags: string[];
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  model: string;
  prompt_version: string;
}

interface ClaudePickRow extends ClaudePickResult {
  game_date: string;
  result: string | null;
  pnl: number | null;
  clv: number | null;
  created_at: string;
  settled_at: string | null;
  book_line: number | null;
  book_odds: number | null;
}

interface RecentResponse {
  picks: ClaudePickRow[];
  summary: {
    n_total: number;
    n_settled: number;
    wins: number;
    losses: number;
    win_rate: number | null;
    total_pnl: number;
  } | null;
}

/* ───────── Catalogs ───────── */

const SPORTS = [
  { value: "mlb", label: "MLB" },
  { value: "nba", label: "NBA" },
  { value: "nfl", label: "NFL" },
  { value: "nhl", label: "NHL" },
  { value: "ncaab", label: "NCAAB" },
  { value: "ncaaf", label: "NCAAF" },
];

const MARKETS_BY_SPORT: Record<string, { value: string; label: string }[]> = {
  mlb: [
    { value: "ml", label: "Moneyline" },
    { value: "run_line", label: "Run Line" },
    { value: "total", label: "Game Total" },
    { value: "f5_ml", label: "First 5 ML" },
    { value: "f5_total", label: "First 5 Total" },
    { value: "nrfi", label: "NRFI" },
  ],
  nba: [
    { value: "ml", label: "Moneyline" },
    { value: "spread", label: "Spread" },
    { value: "total", label: "Game Total" },
    { value: "1q_spread", label: "1Q Spread" },
    { value: "1h_spread", label: "1H Spread" },
    { value: "3q_spread", label: "3Q Spread" },
    { value: "first_10", label: "First to 10 pts" },
    { value: "first_20", label: "First to 20 pts" },
  ],
  nfl: [
    { value: "ml", label: "Moneyline" },
    { value: "spread", label: "Spread" },
    { value: "total", label: "Game Total" },
    { value: "1q_spread", label: "1Q Spread" },
    { value: "1h_spread", label: "1H Spread" },
  ],
  nhl: [
    { value: "ml", label: "Moneyline" },
    { value: "puck_line", label: "Puck Line" },
    { value: "total", label: "Game Total" },
  ],
  ncaab: [
    { value: "ml", label: "Moneyline" },
    { value: "spread", label: "Spread" },
    { value: "total", label: "Game Total" },
  ],
  ncaaf: [
    { value: "ml", label: "Moneyline" },
    { value: "spread", label: "Spread" },
    { value: "total", label: "Game Total" },
  ],
};

/* ───────── Helpers ───────── */

function confidenceColor(c: string): string {
  if (c === "high") return "bg-emerald-600 text-white";
  if (c === "medium") return "bg-amber-500 text-white";
  if (c === "low") return "bg-amber-700 text-white";
  return "bg-zinc-700 text-zinc-300"; // pass
}

function confidenceIcon(c: string) {
  if (c === "high") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (c === "pass") return <XCircle className="h-3.5 w-3.5" />;
  return <Sparkles className="h-3.5 w-3.5" />;
}

/* ───────── Page ───────── */

type Mode = "slate" | "freeform";

export default function ClaudeHandicapperPage() {
  const [mode, setMode] = useState<Mode>("freeform");

  const [sport, setSport] = useState("mlb");
  const [gameId, setGameId] = useState("");
  const [market, setMarket] = useState("ml");
  const [side, setSide] = useState<string>("");
  const [effort, setEffort] = useState<string>("high");

  // Freeform-only fields
  const [awayTeam, setAwayTeam] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [line, setLine] = useState<string>("");
  const [odds, setOdds] = useState<string>("");
  const [gameDate, setGameDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaudePickResult | null>(null);

  const [recent, setRecent] = useState<RecentResponse | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);

  const markets = MARKETS_BY_SPORT[sport] ?? [];

  // When sport changes, reset market to first available
  useEffect(() => {
    if (markets.length > 0 && !markets.find((m) => m.value === market)) {
      setMarket(markets[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport]);

  async function loadRecent(sportFilter?: string) {
    setRecentLoading(true);
    try {
      const url = sportFilter
        ? `/api/claude_picks/recent?limit=30&sport=${sportFilter}`
        : "/api/claude_picks/recent?limit=30";
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as RecentResponse;
      setRecent(data);
    } catch (e) {
      console.error("loadRecent failed", e);
    } finally {
      setRecentLoading(false);
    }
  }

  useEffect(() => {
    loadRecent();
  }, []);

  async function handleSubmit() {
    setError(null);
    setResult(null);

    if (mode === "slate") {
      if (!gameId.trim()) {
        setError("Game ID is required for slate mode");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/claude_pick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sport,
            game_id: gameId.trim(),
            market,
            side: side || null,
            effort,
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error || `Backend returned ${res.status}`);
        } else {
          setResult(body as ClaudePickResult);
          loadRecent();
        }
      } catch (e) {
        setError(`Request failed: ${e}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Freeform mode
    if (!awayTeam.trim() || !homeTeam.trim()) {
      setError("Both away and home team are required for freeform mode");
      return;
    }
    if (!odds.trim()) {
      setError(
        "Odds are required (e.g. -110 or +145) — that's the price you're being offered"
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/claude_pick_freeform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport,
          away_team: awayTeam.trim(),
          home_team: homeTeam.trim(),
          market,
          line: line.trim() === "" ? null : Number(line),
          odds: Number(odds),
          side: side || null,
          game_date: gameDate.trim() || null,
          notes: notes.trim() || null,
          effort,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || `Backend returned ${res.status}`);
      } else {
        setResult(body as ClaudePickResult);
        loadRecent();
      }
    } catch (e) {
      setError(`Request failed: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-amber-500" />
          Claude Handicapper
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Universal bet recommender for any sport / market — backed by Claude
          Opus 4.7 with the full game context (Elo, recent form, lines, model
          predictions). Picks log to <code>claude_picks</code> for tracking.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-950 p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode("freeform")}
          className={cn(
            "px-3 py-1.5 rounded-sm font-mono uppercase tracking-wider transition-colors",
            mode === "freeform"
              ? "bg-amber-500 text-zinc-950"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          Freeform
        </button>
        <button
          type="button"
          onClick={() => setMode("slate")}
          className={cn(
            "px-3 py-1.5 rounded-sm font-mono uppercase tracking-wider transition-colors",
            mode === "slate"
              ? "bg-amber-500 text-zinc-950"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          From Slate (game_id)
        </button>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {mode === "freeform"
              ? "Type any matchup, line, and odds"
              : "Request a recommendation from a known game"}
          </CardTitle>
          {mode === "freeform" && (
            <p className="text-xs text-zinc-500 pt-1">
              The AI uses your matchup + the data layer (Elo, recent form, cached
              model preds when teams are recognized) and reasons against the price
              you supply. Works for any sport, any book, any time — no game_id
              needed.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Common: Sport */}
            <div className="space-y-1">
              <Label>Sport</Label>
              <Select value={sport} onValueChange={(v) => v && setSport(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mode-specific: matchup vs game_id */}
            {mode === "freeform" ? (
              <>
                <div className="space-y-1">
                  <Label>Away team</Label>
                  <Input
                    placeholder="e.g. LAL or Lakers"
                    value={awayTeam}
                    onChange={(e) => setAwayTeam(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Home team</Label>
                  <Input
                    placeholder="e.g. BOS or Celtics"
                    value={homeTeam}
                    onChange={(e) => setHomeTeam(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1 md:col-span-2">
                <Label>Game ID</Label>
                <Input
                  placeholder="e.g. 824203 — from the games table / today's slate"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                />
              </div>
            )}

            {/* Common: Market */}
            <div className="space-y-1">
              <Label>Market</Label>
              <Select value={market} onValueChange={(v) => v && setMarket(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {markets.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Freeform-only: line + odds */}
            {mode === "freeform" && (
              <>
                <div className="space-y-1">
                  <Label>
                    Line{" "}
                    <span className="text-zinc-500 text-[10px]">
                      (blank for moneyline)
                    </span>
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="e.g. -6.5 or 8.5"
                    value={line}
                    onChange={(e) => setLine(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>
                    Odds{" "}
                    <span className="text-amber-500 text-[10px]">
                      (American, required)
                    </span>
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    placeholder="e.g. -110 or +145"
                    value={odds}
                    onChange={(e) => setOdds(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Common: Side */}
            <div className="space-y-1">
              <Label>Side (optional)</Label>
              <Select
                value={side || "auto"}
                onValueChange={(v) => setSide(!v || v === "auto" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Let Claude choose</SelectItem>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="away">Away</SelectItem>
                  <SelectItem value="over">Over</SelectItem>
                  <SelectItem value="under">Under</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Common: Effort */}
            <div className="space-y-1">
              <Label>Effort</Label>
              <Select value={effort} onValueChange={(v) => v && setEffort(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (fastest)</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High (default)</SelectItem>
                  <SelectItem value="xhigh">X-High</SelectItem>
                  <SelectItem value="max">Max (slowest, deepest)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Freeform-only: optional date */}
            {mode === "freeform" && (
              <div className="space-y-1">
                <Label>
                  Game date{" "}
                  <span className="text-zinc-500 text-[10px]">(optional)</span>
                </Label>
                <Input
                  type="date"
                  value={gameDate}
                  onChange={(e) => setGameDate(e.target.value)}
                />
              </div>
            )}

            <div className="flex items-end">
              <Button
                onClick={handleSubmit}
                disabled={
                  loading ||
                  (mode === "slate"
                    ? !gameId.trim()
                    : !awayTeam.trim() || !homeTeam.trim() || !odds.trim())
                }
                className="w-full"
              >
                {loading ? "Asking Claude..." : "Get recommendation"}
              </Button>
            </div>
          </div>

          {/* Freeform-only: notes textarea (full-width) */}
          {mode === "freeform" && (
            <div className="space-y-1">
              <Label>
                Notes{" "}
                <span className="text-zinc-500 text-[10px]">
                  (optional — injuries, weather, anything Claude should weigh)
                </span>
              </Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Mahomes ankle questionable; Allen healthy; 25mph wind crosswind at Highmark"
                rows={3}
                className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-950 border border-red-900 px-3 py-2 text-sm text-red-200">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Pick #{result.pick_id} — {result.sport.toUpperCase()} game{" "}
              {result.game_id} ({result.market})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                className={cn(
                  "text-sm flex items-center gap-1.5",
                  confidenceColor(result.confidence)
                )}
              >
                {confidenceIcon(result.confidence)}
                {result.bet_side.toUpperCase()} —{" "}
                {result.confidence.toUpperCase()}
              </Badge>
              <span className="text-sm text-zinc-400">
                Est. edge:{" "}
                <span
                  className={cn(
                    "font-semibold",
                    result.estimated_edge_pct >= 4
                      ? "text-emerald-400"
                      : result.estimated_edge_pct >= 2
                      ? "text-amber-400"
                      : "text-zinc-400"
                  )}
                >
                  {result.estimated_edge_pct >= 0 ? "+" : ""}
                  {result.estimated_edge_pct.toFixed(2)}%
                </span>
              </span>
              <span className="text-xs text-zinc-500">
                {result.model} · {result.prompt_version}
              </span>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
                Reasoning
              </div>
              <p className="text-sm text-zinc-200">{result.reasoning}</p>
            </div>

            {result.key_factors.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
                  Key factors
                </div>
                <ul className="space-y-1 text-sm text-zinc-300">
                  {result.key_factors.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-500">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.risk_flags.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
                  Risk flags
                </div>
                <ul className="space-y-1 text-sm text-amber-200">
                  {result.risk_flags.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-800">
              Tokens: in {result.usage.input_tokens ?? 0}
              {(result.usage.cache_read_input_tokens ?? 0) > 0 && (
                <> · cache_read {result.usage.cache_read_input_tokens}</>
              )}
              {(result.usage.cache_creation_input_tokens ?? 0) > 0 && (
                <> · cache_write {result.usage.cache_creation_input_tokens}</>
              )}
              · out {result.usage.output_tokens ?? 0}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent picks + track record */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Claude&apos;s track record</span>
            {recent?.summary && recent.summary.n_settled > 0 && (
              <span className="text-xs font-normal text-zinc-400">
                {recent.summary.wins}-{recent.summary.losses} (
                {recent.summary.win_rate
                  ? `${(recent.summary.win_rate * 100).toFixed(1)}%`
                  : "—"}
                ) ·{" "}
                <span
                  className={cn(
                    recent.summary.total_pnl >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  )}
                >
                  {recent.summary.total_pnl >= 0 ? "+" : ""}
                  {recent.summary.total_pnl.toFixed(2)}u
                </span>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="text-sm text-zinc-500">Loading...</div>
          ) : recent && recent.picks.length > 0 ? (
            <div className="space-y-2">
              {recent.picks.map((p) => (
                <div
                  key={p.pick_id}
                  className="flex items-center justify-between text-sm border-b border-zinc-800 pb-2 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={cn("text-xs", confidenceColor(p.confidence))}>
                      {p.bet_side.toUpperCase()}
                    </Badge>
                    <span className="text-zinc-300">
                      {p.sport.toUpperCase()}/{p.market} ·{" "}
                      <span className="text-zinc-500">{p.game_id}</span>
                    </span>
                    <span className="text-zinc-500 text-xs">
                      {p.estimated_edge_pct >= 0 ? "+" : ""}
                      {p.estimated_edge_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    {p.result ? (
                      <span
                        className={cn(
                          "font-semibold",
                          p.result === "win"
                            ? "text-emerald-400"
                            : p.result === "loss"
                            ? "text-red-400"
                            : "text-zinc-400"
                        )}
                      >
                        {p.result === "win" ? "W" : p.result === "loss" ? "L" : "—"}{" "}
                        {p.pnl != null && (
                          <>{p.pnl >= 0 ? "+" : ""}{p.pnl.toFixed(2)}u</>
                        )}
                      </span>
                    ) : (
                      <span className="text-zinc-600">pending</span>
                    )}
                    <span>{p.created_at?.slice(5, 16).replace("T", " ")}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">
              No picks yet. Use the form above to get the first one.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
