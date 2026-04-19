"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusRow {
  strategy: string;
  status: "paused" | "tracking" | "active";
  reason: string | null;
  updated_at: string | null;
}

interface ApiResp {
  rows: StatusRow[];
  generated_at: string;
  error?: string;
}

const STATUS_STYLES: Record<string, string> = {
  paused: "bg-[var(--loss)]/15 text-[var(--loss)] ring-1 ring-[var(--loss)]/30",
  tracking: "bg-[var(--lean)]/15 text-[var(--lean)] ring-1 ring-[var(--lean)]/30",
  active: "bg-[var(--win)]/15 text-[var(--win)] ring-1 ring-[var(--win)]/30",
};

export function StrategyStatusPanel() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/strategy-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => !cancelled && setData(j))
      .catch(() => !cancelled && setData({ rows: [], generated_at: new Date().toISOString() }))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const paused = data?.rows.filter((r) => r.status === "paused") ?? [];
  const tracking = data?.rows.filter((r) => r.status === "tracking") ?? [];

  return (
    <Card>
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span>Strategy Status</span>
          <span className="font-normal text-[10px] tabular-nums">
            {paused.length} paused · {tracking.length} tracking
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : data?.rows.length === 0 ? (
          <div className="p-4 text-sm italic text-muted-foreground">
            All strategies active — none paused or in cold-start.
          </div>
        ) : (
          <div className="divide-y">
            {data?.rows.map((r) => (
              <div key={r.strategy} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <Badge className={cn("font-mono text-[10px] tracking-wider shrink-0", STATUS_STYLES[r.status])}>
                  {r.status.toUpperCase()}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-semibold">{r.strategy}</div>
                  {r.reason && (
                    <div className="text-xs text-muted-foreground mt-0.5">{r.reason}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
