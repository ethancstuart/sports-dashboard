"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HealthRow {
  chain: string;
  source: string;
  calls: number;
  successes: number;
  success_rate: number;
  last_success: string | null;
  degraded: boolean;
}

interface ApiResp {
  rows: HealthRow[];
  generated_at: string;
  error?: string;
}

export function SourceHealthPanel() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/source-health", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => !cancelled && setData(j))
      .catch(() => !cancelled && setData({ rows: [], generated_at: new Date().toISOString() }))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const rows = data?.rows ?? [];
  const degradedCount = rows.filter((r) => r.degraded).length;

  return (
    <Card>
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span>Source Health · 24h</span>
          <span className="font-normal text-[10px] tabular-nums">
            {rows.length} source{rows.length === 1 ? "" : "s"} ·{" "}
            {degradedCount > 0 ? (
              <span className="text-[var(--loss)] font-semibold">
                {degradedCount} DEGRADED
              </span>
            ) : (
              <span className="text-[var(--win)] font-semibold">ALL HEALTHY</span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm italic text-muted-foreground">
            No source-health data yet. Run a few backfills or wait for
            the hourly watchdog to populate source_health_log.
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((r, i) => (
              <div key={`${r.chain}-${r.source}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.chain}
                  </div>
                  <div className="font-mono font-semibold truncate">
                    {r.source}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "font-mono text-sm font-bold",
                    r.degraded ? "text-[var(--loss)]" : "text-[var(--win)]",
                  )}>
                    {(r.success_rate * 100).toFixed(0)}%
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.successes}/{r.calls} calls
                  </div>
                </div>
                {r.degraded && (
                  <Badge className="bg-[var(--loss)]/15 text-[var(--loss)] ring-1 ring-[var(--loss)]/30 text-[10px]">
                    DEGRADED
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
