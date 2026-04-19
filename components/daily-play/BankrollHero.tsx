"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BankrollHeroProps {
  startingBankroll: number;
  currentBankroll: number;
  dailyGoal: number;
  realizedPnlUnits: number;
  unitDollars: number;
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function fmtUSDPrecise(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function BankrollHero({
  startingBankroll,
  currentBankroll,
  dailyGoal,
  realizedPnlUnits,
  unitDollars,
}: BankrollHeroProps) {
  const pct = Math.min((currentBankroll / dailyGoal) * 100, 100);
  const pnlDollars = realizedPnlUnits * unitDollars;
  const pnlSign = pnlDollars > 0 ? "+" : pnlDollars < 0 ? "−" : "";
  const pnlAbs = Math.abs(pnlDollars);
  const pnlClass =
    pnlDollars > 0
      ? "text-[var(--win)]"
      : pnlDollars < 0
        ? "text-[var(--loss)]"
        : "text-muted-foreground";
  const goalReached = currentBankroll >= dailyGoal;

  return (
    <Card className="overflow-hidden border-2">
      <div className="border-b bg-gradient-to-br from-[#0d253f] via-[#0d253f] to-[#1a3d62] p-6 text-white">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="space-y-1.5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#8aa9c9]">
              Daily Play · Live Bankroll
            </div>
            <div className="font-mono text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">
              {fmtUSDPrecise(currentBankroll)}
            </div>
            <div className="flex items-baseline gap-3 text-sm">
              <span className="text-[#bcd0e2]">
                Goal {fmtUSD(dailyGoal)}
              </span>
              <span className="text-[#bcd0e2]">·</span>
              <span className={cn("font-mono font-semibold", pnlClass)}>
                {pnlSign}
                {fmtUSDPrecise(pnlAbs)}
                <span className="ml-1 text-xs text-[#8aa9c9]">
                  ({realizedPnlUnits > 0 ? "+" : ""}
                  {realizedPnlUnits.toFixed(2)}u realized)
                </span>
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-[#8aa9c9]">
              Progress
            </div>
            <div className="font-mono text-3xl font-bold tabular-nums">
              {pct.toFixed(1)}%
            </div>
            {goalReached && (
              <div className="mt-1 inline-block rounded-sm bg-[var(--win)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Goal hit · keep playing
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-card p-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1f7a45] to-[#2aa55c] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Start: {fmtUSDPrecise(startingBankroll)}</span>
          <span>Sweep above {fmtUSD(startingBankroll)} at 11:30 PM ET</span>
        </div>
      </div>
    </Card>
  );
}
