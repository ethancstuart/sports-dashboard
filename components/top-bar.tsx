"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HealthRow {
  n: number;
  wins: number;
  losses: number;
  actual_wr: number | null;
  breakeven_wr: number | null;
  brier: number | null;
  avg_clv: number | null;
}

function formatNow() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function TopBar() {
  const [rows, setRows] = useState<HealthRow[] | null>(null);
  const [now, setNow] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    setNow(formatNow());

    function refresh() {
      fetch("/api/model-health")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setRows(d);
          setNow(formatNow());
          setLastSync(new Date().toISOString());
        })
        .catch(() => {});
    }

    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  // Aggregate model-performance snapshot (strategies with >=20 settled bets)
  const seasoned = (rows ?? []).filter((r) => r.n >= 20);
  const wins = seasoned.reduce((s, r) => s + r.wins, 0);
  const losses = seasoned.reduce((s, r) => s + r.losses, 0);
  const decided = wins + losses;
  const actual = decided > 0 ? wins / decided : null;
  const breakeven =
    seasoned.length > 0
      ? seasoned.reduce((s, r) => s + (r.breakeven_wr ?? 0), 0) /
        seasoned.length
      : null;
  const delta = actual != null && breakeven != null ? actual - breakeven : null;
  const brierVals = seasoned
    .map((r) => r.brier)
    .filter((b): b is number => b != null);
  const brier =
    brierVals.length > 0
      ? brierVals.reduce((s, b) => s + b, 0) / brierVals.length
      : null;
  const clvVals = seasoned
    .map((r) => r.avg_clv)
    .filter((c): c is number => c != null);
  const clv =
    clvVals.length > 0
      ? clvVals.reduce((s, c) => s + c, 0) / clvVals.length
      : null;

  return (
    <div className="flex h-10 items-center justify-between border-b border-border bg-card px-6 text-xs">
      {/* Left: date + live badge */}
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{now}</span>
        <Badge
          variant="outline"
          className="h-5 border-[var(--live)] bg-[var(--live)]/10 px-1.5 text-[10px] font-medium text-[var(--live)]"
        >
          LIVE
        </Badge>
      </div>

      {/* Center: model-health ticker */}
      <div className="hidden items-center gap-6 md:flex">
        <TickerItem
          label="WR vs BE"
          value={
            delta != null
              ? `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}pp`
              : "—"
          }
          color={
            delta == null
              ? undefined
              : delta >= 0
              ? "text-[var(--win)]"
              : "text-[var(--loss)]"
          }
        />
        <TickerItem
          label="WR"
          value={actual != null ? fmtPct(actual, 1) : "—"}
        />
        <TickerItem
          label="CLV"
          value={clv != null ? fmtPct(clv, 1) : "—"}
          color={
            clv == null
              ? undefined
              : clv > 0
              ? "text-[var(--win)]"
              : "text-[var(--loss)]"
          }
        />
        <TickerItem
          label="BRIER"
          value={brier != null ? brier.toFixed(3) : "—"}
        />
        <TickerItem label="N" value={String(decided)} />
      </div>

      {/* Right: sync */}
      <div className="text-muted-foreground">
        {lastSync && (
          <span>
            SYNC{" "}
            {new Date(lastSync).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function TickerItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("font-semibold tabular-nums", color)}>{value}</span>
    </div>
  );
}
