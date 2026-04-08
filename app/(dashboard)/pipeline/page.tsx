"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { MetricCard } from "@/components/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */

interface Alert {
  timestamp: string;
  severity: string;
  message: string;
  details: string;
  [key: string]: unknown;
}

interface SyncSummary {
  last_sync: string | null;
  status: string;
  [key: string]: unknown;
}

/* ---------- static data ---------- */

const SCHEDULED_TASKS = [
  {
    name: "SportsPipeline-Daily",
    schedule: "9:00 AM daily",
    description: "Full pipeline run: scrape, predict, pick",
  },
  {
    name: "ClosingLines",
    schedule: "6:30 PM daily",
    description: "Capture closing lines for CLV tracking",
  },
  {
    name: "Retrain",
    schedule: "Sun 11:59 PM weekly",
    description: "Retrain all models with latest data",
  },
];

/* ---------- helpers ---------- */

function severityColor(severity: string): string {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return "text-[var(--loss)]";
    case "WARNING":
      return "text-[var(--paused)]";
    case "INFO":
    default:
      return "text-muted-foreground";
  }
}

// severityBg available for future use with alert cards

function fmtTimestamp(ts: string | null): string {
  if (!ts) return "--";
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return ts;
  }
}

function timeSince(ts: string | null): string {
  if (!ts) return "Unknown";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "Unknown";
  }
}

/* ---------- alert columns ---------- */

const alertColumns: Column<Alert>[] = [
  {
    key: "timestamp",
    header: "Time",
    render: (r) => (
      <span className="text-xs">{fmtTimestamp(r.timestamp)}</span>
    ),
  },
  {
    key: "severity",
    header: "Severity",
    render: (r) => (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase",
          severityColor(r.severity)
        )}
      >
        {r.severity}
      </span>
    ),
  },
  { key: "message", header: "Message" },
  {
    key: "details",
    header: "Details",
    className: "max-w-[300px] truncate",
    render: (r) => (
      <span className="text-xs text-muted-foreground" title={r.details}>
        {r.details || "--"}
      </span>
    ),
  },
];

/* ---------- skeleton ---------- */

function PipelineSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="h-6 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function PipelineControlPage() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([
        fetch("/api/alerts").then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
        fetch("/api/summary").then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
      ]);

      if (results[0].status === "fulfilled") {
        setAlerts(results[0].value);
      } else {
        setAlerts([]);
        setError("Failed to load alerts");
      }

      if (results[1].status === "fulfilled") {
        setSummary(results[1].value);
      }
    }
    load();
  }, []);

  const syncStatus = summary?.status ?? "UNKNOWN";
  const lastSync = summary?.last_sync ?? null;

  const criticalCount =
    alerts?.filter((a) => a.severity?.toUpperCase() === "CRITICAL").length ?? 0;
  const warningCount =
    alerts?.filter((a) => a.severity?.toUpperCase() === "WARNING").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-mono text-xl font-bold tracking-tight">
          PIPELINE CONTROL
        </h1>
        <p className="text-sm text-muted-foreground">
          Task scheduling &middot; Sync status &middot; Alert log
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-[var(--paused)]/30 bg-[var(--paused)]/10 px-4 py-2 text-sm text-[var(--paused)]">
          {error}
        </div>
      )}

      {alerts === null ? (
        <PipelineSkeleton />
      ) : (
        <>
          {/* Sync Status + Health Summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Sync Status
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={syncStatus === "ok" || syncStatus === "healthy" ? "LIVE" : "MONITOR"} />
                </div>
              </CardContent>
            </Card>
            <MetricCard
              label="Last Sync"
              value={lastSync ? timeSince(lastSync) : "--"}
              subtext={fmtTimestamp(lastSync)}
            />
            <MetricCard
              label="Critical Alerts"
              value={String(criticalCount)}
              className={criticalCount > 0 ? "text-[var(--loss)]" : undefined}
            />
            <MetricCard
              label="Warnings"
              value={String(warningCount)}
              className={warningCount > 0 ? "text-[var(--paused)]" : undefined}
            />
          </div>

          {/* Scheduled Tasks */}
          <section className="space-y-3">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Scheduled Tasks
            </h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-xs uppercase">
                      Task
                    </TableHead>
                    <TableHead className="font-mono text-xs uppercase">
                      Schedule
                    </TableHead>
                    <TableHead className="font-mono text-xs uppercase">
                      Description
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SCHEDULED_TASKS.map((task) => (
                    <TableRow key={task.name}>
                      <TableCell className="font-mono text-sm font-semibold">
                        {task.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {task.schedule}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.description}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Alert Log */}
          <section className="space-y-3">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Alert Log
            </h2>
            <DataTable<Alert>
              columns={alertColumns}
              data={alerts}
              emptyMessage="No alerts -- all clear"
            />
          </section>

          {/* Health Report */}
          {summary && (
            <section className="space-y-3">
              <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Health Report
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(summary)
                  .filter(
                    ([key]) =>
                      !["last_sync", "status"].includes(key) &&
                      typeof summary[key] !== "object"
                  )
                  .map(([key, value]) => (
                    <Card key={key}>
                      <CardContent className="p-4">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                          {key.replace(/_/g, " ")}
                        </div>
                        <div className="mt-1 font-mono text-lg font-bold">
                          {String(value ?? "--")}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
