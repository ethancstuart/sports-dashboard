"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Strategy {
  strategy: string;
  n: number;
  clv_mean: number | null;
  clv_tstat: number | null;
  kelly_multiplier: number;
  roi: number | null;
  disabled: number;
  disabled_at: string | null;
}

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
  clv_component: number;
  market_move_component: number;
  correlation_penalty: number;
  kelly_multiplier: number;
}

interface TruthEngineData {
  generated_at: string;
  strategies: Strategy[];
  disabled_strategies: Array<{ strategy: string; n: number; clv_tstat: number }>;
  open_picks: unknown[];
}

interface TrustScoresData {
  picks: TrustPick[];
}

function multColor(mult: number): string {
  if (mult >= 1.5) return "text-emerald-400";
  if (mult >= 1.1) return "text-emerald-300";
  if (mult <= 0.001) return "text-red-500";
  if (mult < 0.9) return "text-amber-400";
  return "text-zinc-300";
}

function labelColor(label: string): string {
  if (label === "PROVEN EDGE") return "bg-emerald-600 text-white";
  if (label === "STRONG") return "bg-emerald-800 text-emerald-100";
  if (label === "WEAK") return "bg-amber-800 text-amber-100";
  if (label === "SKIP") return "bg-red-800 text-red-100";
  return "bg-zinc-700 text-zinc-200";
}

export default function TruthEnginePage() {
  const [te, setTe] = useState<TruthEngineData | null>(null);
  const [ts, setTs] = useState<TrustScoresData | null>(null);
  const [err, setErr] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [teRes, tsRes] = await Promise.all([
        fetch("/api/truth_engine", { cache: "no-store" }),
        fetch("/api/trust_scores", { cache: "no-store" }),
      ]);
      if (teRes.ok) setTe(await teRes.json());
      else setErr(`Truth Engine: ${teRes.status}`);
      if (tsRes.ok) setTs(await tsRes.json());
      else setErr((prev) => prev + ` Trust Scores: ${tsRes.status}`);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const sorted = te?.strategies.slice().sort(
    (a, b) => (b.kelly_multiplier || 0) - (a.kelly_multiplier || 0),
  ) ?? [];

  return (
    <div className="p-6 space-y-6 font-mono text-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Truth Engine
          </h1>
          <div className="text-xs text-zinc-500">
            What the model believes right now.{" "}
            {te?.generated_at && (
              <span>Refreshed {new Date(te.generated_at).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {err && (
        <Card>
          <CardContent className="p-3 text-red-400 text-xs">{err}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="text-zinc-200 font-semibold mb-2">
            Strategies · proven-to-beat-Vegas ranking
          </div>
          <table className="w-full text-xs">
            <thead className="text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="text-left py-1">Strategy</th>
                <th className="text-right">n</th>
                <th className="text-right">CLV</th>
                <th className="text-right">t-stat</th>
                <th className="text-right">Kelly ×</th>
                <th className="text-right">ROI</th>
                <th className="text-right">State</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.strategy} className="border-b border-zinc-900">
                  <td className="py-1 text-zinc-200">{s.strategy}</td>
                  <td className="text-right text-zinc-400">{s.n}</td>
                  <td className={cn(
                    "text-right",
                    (s.clv_mean ?? 0) >= 0 ? "text-emerald-400" : "text-red-400",
                  )}>
                    {((s.clv_mean ?? 0) * 100).toFixed(2)}%
                  </td>
                  <td className={cn(
                    "text-right",
                    (s.clv_tstat ?? 0) >= 0 ? "text-emerald-400" : "text-red-400",
                  )}>
                    {(s.clv_tstat ?? 0).toFixed(2)}
                  </td>
                  <td className={cn(
                    "text-right font-semibold",
                    multColor(s.kelly_multiplier),
                  )}>
                    {s.kelly_multiplier.toFixed(2)}
                  </td>
                  <td className={cn(
                    "text-right",
                    (s.roi ?? 0) >= 0 ? "text-emerald-400" : "text-red-400",
                  )}>
                    {((s.roi ?? 0) * 100).toFixed(1)}%
                  </td>
                  <td className="text-right">
                    {s.disabled ? (
                      <Badge className="bg-red-700 text-white">DISABLED</Badge>
                    ) : s.kelly_multiplier >= 1.2 ? (
                      <Badge className="bg-emerald-700 text-white">UP</Badge>
                    ) : s.kelly_multiplier < 0.9 ? (
                      <Badge className="bg-amber-700 text-white">DN</Badge>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-zinc-200 font-semibold mb-2">
            Open picks · trust-score ranked
          </div>
          <table className="w-full text-xs">
            <thead className="text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="text-left py-1">Pick</th>
                <th className="text-left">Sport</th>
                <th className="text-left">Strategy</th>
                <th className="text-left">Side</th>
                <th className="text-right">Line</th>
                <th className="text-right">Edge</th>
                <th className="text-right">Kelly</th>
                <th className="text-right">Move</th>
                <th className="text-right">Trust</th>
                <th className="text-right">Label</th>
              </tr>
            </thead>
            <tbody>
              {(ts?.picks ?? []).slice(0, 25).map((p) => (
                <tr key={p.pick_id} className="border-b border-zinc-900">
                  <td className="py-1 text-zinc-500">#{p.pick_id}</td>
                  <td className="text-zinc-300">{p.sport}</td>
                  <td className="text-zinc-200">{p.strategy}</td>
                  <td className="text-zinc-300">{p.bet_side}</td>
                  <td className="text-right text-zinc-300">
                    {p.book_line ?? "—"}
                  </td>
                  <td className="text-right text-emerald-400">
                    {(p.edge * 100).toFixed(1)}%
                  </td>
                  <td className="text-right text-zinc-300">
                    {(p.kelly_size * 100).toFixed(2)}%
                  </td>
                  <td className={cn(
                    "text-right",
                    (p.pick_market_move ?? 0) > 0 ? "text-emerald-400" :
                    (p.pick_market_move ?? 0) < 0 ? "text-red-400" :
                    "text-zinc-500",
                  )}>
                    {p.pick_market_move !== null
                      ? p.pick_market_move.toFixed(3)
                      : "—"}
                  </td>
                  <td className="text-right text-zinc-100 font-semibold">
                    {p.trust_score}
                  </td>
                  <td className="text-right">
                    <Badge className={labelColor(p.trust_label)}>
                      {p.trust_label}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {te && te.disabled_strategies.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-red-400 font-semibold mb-2">
              Auto-disabled — no bets placed until CLV recovers
            </div>
            <ul className="text-xs text-zinc-400 space-y-1">
              {te.disabled_strategies.map((d) => (
                <li key={d.strategy}>
                  <span className="text-zinc-200">{d.strategy}</span>{" "}
                  n={d.n} · t-stat {d.clv_tstat.toFixed(2)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
