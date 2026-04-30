"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TrustPick {
  pick_id: number;
  sport: string;
  strategy: string;
  game_id: string;
  bet_side: string;
  edge: number;
  kelly_size: number;
  book_line: number | null;
  book_odds: number | null;
  pick_market_move: number | null;
  trust_score: number;
  trust_label: string;
}

interface PlacementState {
  status: "pending" | "placed" | "skipped" | "submitting" | "error";
  fill_odds?: number;
  fill_stake?: number;
  book?: string;
  error?: string;
}

function labelColor(label: string): string {
  if (label === "PROVEN EDGE") return "bg-emerald-600 text-white";
  if (label === "STRONG") return "bg-emerald-800 text-emerald-100";
  if (label === "WEAK") return "bg-amber-800 text-amber-100";
  if (label === "SKIP") return "bg-red-800 text-red-100";
  return "bg-zinc-700 text-zinc-200";
}

const BOOKS = [
  "draftkings",
  "fanduel",
  "pinnacle",
  "betmgm",
  "caesars",
  "espnbet",
  "fanatics",
  "kalshi",
];

export default function PlaceBetsPage() {
  const [picks, setPicks] = useState<TrustPick[]>([]);
  const [states, setStates] = useState<Record<number, PlacementState>>({});
  const [err, setErr] = useState<string>("");
  const [loading, setLoading] = useState(true);
  // bankroll surface placeholder — kept as state so a future revision can
  // wire the trust-score / Kelly-sizing display back in without re-adding
  // the field. Suppress the unused-vars rule rather than delete state.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_bankroll, _setBankroll] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/trust_scores", { cache: "no-store" });
      if (!r.ok) {
        setErr(`Trust scores: ${r.status}`);
        return;
      }
      const data = await r.json();
      setPicks(data.picks ?? []);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function placeBet(p: TrustPick) {
    const cur = states[p.pick_id] ?? { status: "pending" };
    const fill_odds = cur.fill_odds ?? p.book_odds ?? -110;
    const fill_stake = cur.fill_stake ?? Number((p.kelly_size * 100).toFixed(2));
    const book = cur.book ?? "pinnacle";

    setStates((s) => ({
      ...s,
      [p.pick_id]: { status: "submitting", fill_odds, fill_stake, book },
    }));

    try {
      const r = await fetch("/api/record_placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pick_id: p.pick_id,
          fill_odds,
          fill_stake,
          book,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setStates((s) => ({
          ...s,
          [p.pick_id]: {
            status: "error",
            error: data?.error ?? "unknown",
            fill_odds,
            fill_stake,
            book,
          },
        }));
        return;
      }
      setStates((s) => ({
        ...s,
        [p.pick_id]: { status: "placed", fill_odds, fill_stake, book },
      }));
    } catch (e) {
      setStates((s) => ({
        ...s,
        [p.pick_id]: {
          status: "error",
          error: String(e),
          fill_odds,
          fill_stake,
          book,
        },
      }));
    }
  }

  function skipPick(p: TrustPick) {
    setStates((s) => ({
      ...s,
      [p.pick_id]: { status: "skipped" },
    }));
  }

  function updateField(
    pick_id: number,
    field: "fill_odds" | "fill_stake" | "book",
    value: number | string,
  ) {
    setStates((s) => ({
      ...s,
      [pick_id]: {
        ...(s[pick_id] ?? { status: "pending" }),
        [field]: value,
      },
    }));
  }

  useEffect(() => {
    load();
  }, []);

  const remaining = picks.filter(
    (p) => (states[p.pick_id]?.status ?? "pending") === "pending",
  );
  const placed = picks.filter(
    (p) => states[p.pick_id]?.status === "placed",
  );

  return (
    <div className="p-3 sm:p-6 space-y-4 font-mono text-sm pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Place Bets</h1>
          <div className="text-xs text-zinc-500">
            {remaining.length} pending · {placed.length} placed
          </div>
        </div>
        <Button
          onClick={load}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          {loading ? "..." : "Refresh"}
        </Button>
      </div>

      {err && (
        <Card>
          <CardContent className="p-3 text-red-400 text-xs">{err}</CardContent>
        </Card>
      )}

      {picks.length === 0 && !loading && (
        <Card>
          <CardContent className="p-6 text-center text-zinc-500">
            No open picks. Check back after the daily brief lands.
          </CardContent>
        </Card>
      )}

      {picks.map((p) => {
        const state = states[p.pick_id] ?? { status: "pending" as const };
        const isDone =
          state.status === "placed" || state.status === "skipped";
        const cardClass = cn(
          "transition-opacity",
          isDone && "opacity-50",
        );

        return (
          <Card key={p.pick_id} className={cardClass}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-zinc-100 font-semibold">
                    {p.sport.toUpperCase()} · {p.strategy} · {p.bet_side}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Trust {p.trust_score} · Edge{" "}
                    <span className="text-emerald-400">
                      {(p.edge * 100).toFixed(1)}%
                    </span>{" "}
                    · Line {p.book_line ?? "—"} @ {p.book_odds ?? "—"}
                  </div>
                </div>
                <Badge className={labelColor(p.trust_label)}>
                  {p.trust_label}
                </Badge>
              </div>

              {p.pick_market_move !== null && (
                <div
                  className={cn(
                    "text-xs",
                    p.pick_market_move > 0
                      ? "text-emerald-400"
                      : "text-red-400",
                  )}
                >
                  Market move: {p.pick_market_move.toFixed(3)}
                </div>
              )}

              {!isDone && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-zinc-500">Odds</label>
                      <input
                        type="number"
                        defaultValue={p.book_odds ?? -110}
                        onChange={(e) =>
                          updateField(
                            p.pick_id,
                            "fill_odds",
                            Number(e.target.value),
                          )
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Stake $</label>
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={(p.kelly_size * 100).toFixed(2)}
                        onChange={(e) =>
                          updateField(
                            p.pick_id,
                            "fill_stake",
                            Number(e.target.value),
                          )
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500">Book</label>
                      <select
                        defaultValue="pinnacle"
                        onChange={(e) =>
                          updateField(p.pick_id, "book", e.target.value)
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
                      >
                        {BOOKS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => placeBet(p)}
                      disabled={state.status === "submitting"}
                      className="flex-1 bg-emerald-700 hover:bg-emerald-600"
                    >
                      {state.status === "submitting"
                        ? "Logging..."
                        : "✓ Placed"}
                    </Button>
                    <Button
                      onClick={() => skipPick(p)}
                      variant="outline"
                      className="flex-1"
                    >
                      ✕ Skip
                    </Button>
                  </div>

                  {state.status === "error" && (
                    <div className="text-xs text-red-400">
                      Error: {state.error}
                    </div>
                  )}
                </>
              )}

              {state.status === "placed" && (
                <div className="text-xs text-emerald-400">
                  ✓ Logged: ${state.fill_stake} @ {state.fill_odds} on{" "}
                  {state.book}
                </div>
              )}

              {state.status === "skipped" && (
                <div className="text-xs text-zinc-500">Skipped</div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 px-4 py-3 flex justify-between text-xs">
        <div className="text-zinc-400">
          {placed.length} placed · {remaining.length} pending
        </div>
        <div className="text-zinc-500">/place-bets</div>
      </div>
    </div>
  );
}
