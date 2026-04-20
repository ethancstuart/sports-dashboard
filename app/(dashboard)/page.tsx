"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BankrollHero } from "@/components/daily-play/BankrollHero";
import { WaveCard } from "@/components/daily-play/WaveCard";
import { StrategyStatusPanel } from "@/components/daily-play/StrategyStatusPanel";
import { SourceHealthPanel } from "@/components/daily-play/SourceHealthPanel";
import { localToday } from "@/lib/constants";
import type { DailyPlan, WaveId } from "@/lib/sequencer";
import { cn } from "@/lib/utils";

interface SettledPick {
  pick_id: number;
  sport: string;
  strategy: string;
  game_id: string;
  bet_side: string | null;
  edge: number | null;
  book_line: number | null;
  book_odds: number | null;
  result: "win" | "loss" | "push" | null;
  pnl: number | null;
  settled_at: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

interface DailyPlanResponse {
  plan: DailyPlan;
  settled: SettledPick[];
  meta: {
    date: string;
    starting_bankroll: number;
    current_bankroll: number;
    realized_pnl_units: number;
    unit_dollars: number;
    total_picks: number;
    generated_at: string;
  };
}

export default function HomePage() {
  const [data, setData] = useState<DailyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/daily-plan?date=${localToday()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DailyPlanResponse;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 60_000); // refresh every 60s
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <Header date={data?.meta.date ?? localToday()} />

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : data ? (
        <>
          <BankrollHero
            startingBankroll={data.meta.starting_bankroll}
            currentBankroll={data.meta.current_bankroll}
            dailyGoal={data.plan.daily_goal}
            realizedPnlUnits={data.meta.realized_pnl_units}
            unitDollars={data.meta.unit_dollars}
          />

          <RulesBanner />

          <div className="space-y-3">
            {data.plan.waves.map((wave) => {
              const isActive = wave.wave_id === data.plan.active_wave_id;
              const order: WaveId[] = ["W1", "W2", "W3"];
              const isPast =
                order.indexOf(wave.wave_id) <
                order.indexOf(data.plan.active_wave_id);
              return (
                <WaveCard
                  key={wave.wave_id}
                  wave={wave}
                  isActive={isActive}
                  isPast={isPast}
                />
              );
            })}
          </div>

          <SettledFeed settled={data.settled} />

          <StrategyStatusPanel />

          <SourceHealthPanel />
        </>
      ) : null}
    </div>
  );
}

function Header({ date }: { date: string }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          EdgeWatch
        </div>
        <h1 className="mt-1 font-mono text-2xl font-bold tracking-tight">
          Daily Play
        </h1>
        <div className="text-sm text-muted-foreground">
          Turn $200 into $1,000 today.{" "}
          <span className="font-mono text-xs">{date}</span>
        </div>
      </div>
    </div>
  );
}

function RulesBanner() {
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
      <span className="font-semibold">Daily Play rules:</span> $200 fresh each
      morning · play waves straight through even if $1K hit · never chase if
      behind · nightly sweep at 11:30 PM ET.
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm text-[var(--loss)]">
          Failed to load Daily Play: {error}
        </div>
      </CardContent>
    </Card>
  );
}

function fmtSettleTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function SettledFeed({ settled }: { settled: SettledPick[] }) {
  if (settled.length === 0) {
    return (
      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Today’s Settled
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-sm italic text-muted-foreground">
          Nothing settled yet — check back after the early games close.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
          Today’s Settled · {settled.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {settled.map((s) => {
            const resultClass =
              s.result === "win"
                ? "text-[var(--win)]"
                : s.result === "loss"
                  ? "text-[var(--loss)]"
                  : "text-muted-foreground";
            return (
              <div
                key={s.pick_id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs text-muted-foreground">
                    {s.sport.toUpperCase()} · {fmtSettleTime(s.settled_at)} ET
                  </div>
                  <div className="font-mono truncate">
                    {s.strategy.replace(/_/g, " ").toUpperCase()}{" "}
                    {(s.bet_side ?? "").toUpperCase()}{" "}
                    {s.away_team_id && s.home_team_id
                      ? `· ${s.away_team_id} @ ${s.home_team_id}`
                      : ""}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn("font-mono uppercase", resultClass)}
                >
                  {s.result ?? "—"}
                </Badge>
                <div
                  className={cn(
                    "font-mono w-20 text-right tabular-nums",
                    resultClass,
                  )}
                >
                  {s.pnl !== null
                    ? `${s.pnl > 0 ? "+" : ""}${s.pnl.toFixed(2)}u`
                    : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
