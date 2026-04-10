"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { fmtUnits, fmtPct, fmtCurrency, pnlColor } from "@/lib/format";
import { BANKROLL_BASE } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TickerData {
  total_pnl: number;
  wins: number;
  losses: number;
  open_bets: number;
  last_sync: string | null;
}

function formatNow() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function TopBar() {
  const [data, setData] = useState<TickerData | null>(null);
  const [now, setNow] = useState("");

  useEffect(() => {
    setNow(formatNow());

    function refresh() {
      fetch("/api/summary")
        .then((r) => r.json())
        .then((d) => {
          setData(d);
          setNow(formatNow()); // Update date on each refresh
        })
        .catch(() => {});
    }

    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  const bankroll = BANKROLL_BASE + (data?.total_pnl ?? 0);
  const settled = (data?.wins ?? 0) + (data?.losses ?? 0);
  const winRate = settled > 0 ? (data?.wins ?? 0) / settled : null;

  return (
    <div className="flex h-10 items-center justify-between border-b border-border bg-card/50 px-6 font-mono text-xs">
      {/* Left: date + status */}
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground">{now}</span>
        <Badge
          variant="outline"
          className="h-5 border-[var(--live)] px-1.5 text-[10px] text-[var(--live)]"
        >
          LIVE
        </Badge>
      </div>

      {/* Center: ticker strip */}
      {data && (
        <div className="hidden items-center gap-6 md:flex">
          <TickerItem label="P&L" value={fmtUnits(data.total_pnl)} color={pnlColor(data.total_pnl)} />
          <TickerItem label="BANKROLL" value={fmtCurrency(bankroll)} />
          <TickerItem label="WIN%" value={winRate != null ? fmtPct(winRate) : "—"} />
          <TickerItem label="OPEN" value={String(data.open_bets)} />
          <TickerItem label="W-L" value={`${data.wins}-${data.losses}`} />
        </div>
      )}

      {/* Right: sync */}
      <div className="text-muted-foreground">
        {data?.last_sync && (
          <span>
            SYNC{" "}
            {(() => {
              try {
                return new Date(data.last_sync).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              } catch {
                return "—";
              }
            })()}
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
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", color)}>{value}</span>
    </div>
  );
}
