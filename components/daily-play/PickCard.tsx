"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SequencerPick } from "@/lib/sequencer";

interface PickCardProps {
  pick: SequencerPick;
  stake: number;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  HIGH: "bg-[var(--win)] text-white",
  MED: "bg-[var(--lean)]/15 text-[var(--lean)] ring-1 ring-[var(--lean)]/30",
  LOW: "bg-[var(--watch)]/10 text-[var(--watch)] ring-1 ring-[var(--watch)]/20",
};

const TIER_STYLES: Record<string, string> = {
  BET: "bg-[var(--bet)]/15 text-[var(--bet)] ring-1 ring-[var(--bet)]/30",
  LEAN: "bg-[var(--lean)]/15 text-[var(--lean)] ring-1 ring-[var(--lean)]/30",
  WATCH: "bg-[var(--watch)]/10 text-[var(--watch)]",
};

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function winReturn(stake: number, odds: number): number {
  return odds > 0 ? (stake * odds) / 100 : (stake * 100) / Math.abs(odds);
}

function fmtSettleTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function strategyLabel(strategy: string): string {
  return strategy.replace(/_/g, " ").toUpperCase();
}

function defaultRationale(edge: number): string {
  return `Model edge ${(edge * 100).toFixed(1)}% — see Lab tab for model detail.`;
}

function describeBet(pick: SequencerPick): string {
  const sport = pick.sport.toUpperCase();
  const strat = strategyLabel(pick.strategy);
  const side = (pick.bet_side || "").toUpperCase();
  const game =
    pick.away_team_id && pick.home_team_id
      ? ` · ${pick.away_team_id} @ ${pick.home_team_id}`
      : "";
  const line =
    pick.book_line !== null && pick.book_line !== undefined
      ? ` ${pick.book_line > 0 ? "+" : ""}${pick.book_line}`
      : "";
  return `${sport} · ${strat} ${side}${line}${game}`;
}

export function PickCard({ pick, stake }: PickCardProps) {
  const win = winReturn(stake, pick.book_odds);
  const rationale = pick.rationale || defaultRationale(pick.edge);
  const settle = fmtSettleTime(pick.estimated_settle_iso);

  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              className={cn(
                "font-mono text-[10px] tracking-wider",
                CONFIDENCE_STYLES[pick.confidence],
              )}
            >
              {pick.confidence}
            </Badge>
            {pick.rationale_tier && (
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-[10px] tracking-wider",
                  TIER_STYLES[pick.rationale_tier],
                )}
              >
                {pick.rationale_tier}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              settles ~{settle} ET
            </span>
          </div>

          <div className="font-mono text-sm font-semibold leading-snug break-words">
            {describeBet(pick)}
          </div>

          <div className="text-sm text-muted-foreground leading-relaxed">
            {rationale}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-mono text-2xl font-bold tabular-nums">
            {fmtUSD(stake)}
          </div>
          <div className="font-mono text-xs text-[var(--win)]">
            wins {fmtUSD(win)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            @ {fmtOdds(pick.book_odds)}
          </div>
        </div>
      </div>
    </div>
  );
}
