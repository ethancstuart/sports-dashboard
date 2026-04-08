"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function TopBar() {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [now, setNow] = useState("");

  useEffect(() => {
    setNow(new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }));

    fetch("/api/summary")
      .then((r) => r.json())
      .then((d) => setLastSync(d.last_sync))
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-14 items-center justify-between border-b border-border px-6">
      <div className="font-mono text-sm text-muted-foreground">{now}</div>
      <div className="flex items-center gap-3">
        {lastSync && (
          <span className="text-xs text-muted-foreground">
            Synced: {new Date(lastSync).toLocaleString()}
          </span>
        )}
        <Badge variant="outline" className="border-[var(--live)] text-[var(--live)]">
          LIVE
        </Badge>
      </div>
    </div>
  );
}
