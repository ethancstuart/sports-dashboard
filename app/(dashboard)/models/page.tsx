"use client";

import { useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */

interface ModelRecord {
  id: string;
  name: string;
  sport: string;
  model_type: string;
  train_date: string;
  key_metric: number | null;
  key_metric_name: string;
  status: string;
  data: string | null; // JSON blob from pipeline_artifacts
  [key: string]: unknown;
}

interface ModelDetail {
  training_config: Record<string, unknown> | null;
  validation_metrics: Record<string, number> | null;
  feature_importance: { feature: string; importance: number }[] | null;
}

/* ---------- helpers ---------- */

function daysSince(dateStr: string): number {
  const then = new Date(dateStr + "T00:00:00");
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function freshnessColor(days: number): string {
  if (days <= 7) return "text-[var(--win)]";
  if (days <= 14) return "text-yellow-500";
  return "text-[var(--loss)]";
}

function freshnessLabel(days: number): string {
  if (days <= 7) return "FRESH";
  if (days <= 14) return "OK";
  return "STALE";
}

function statusBadgeColor(status: string): string {
  switch (status) {
    case "active":
    case "ACTIVE":
      return "bg-[var(--win)]/20 text-[var(--win)] border-[var(--win)]/30";
    case "retired":
    case "RETIRED":
      return "bg-muted text-muted-foreground";
    case "training":
    case "TRAINING":
      return "bg-blue-500/20 text-blue-400 border-blue-400/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function parseModelData(raw: string | null): ModelDetail {
  const empty: ModelDetail = {
    training_config: null,
    validation_metrics: null,
    feature_importance: null,
  };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    return {
      training_config: parsed.training_config ?? null,
      validation_metrics: parsed.validation_metrics ?? null,
      feature_importance: parsed.feature_importance ?? null,
    };
  } catch {
    return empty;
  }
}

/* ---------- skeleton ---------- */

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function FreshnessSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="mb-2 h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

export default function ModelRegistryPage() {
  const [models, setModels] = useState<ModelRecord[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/models");
        const data: ModelRecord[] = await res.json();
        setModels(data);
      } catch {
        setModels([]);
      }
    }
    load();
  }, []);

  function toggleExpand(row: ModelRecord) {
    setExpandedId((prev) => (prev === row.id ? null : row.id));
  }

  /* ---------- column defs ---------- */

  const columns: Column<ModelRecord>[] = [
    {
      key: "name",
      header: "Model Name",
      render: (r) => (
        <span className="font-semibold">{r.name}</span>
      ),
    },
    {
      key: "sport",
      header: "Sport",
      render: (r) => (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
          {r.sport}
        </span>
      ),
    },
    { key: "model_type", header: "Type" },
    {
      key: "train_date",
      header: "Train Date",
      render: (r) => fmtDate(r.train_date),
    },
    {
      key: "key_metric",
      header: "Key Metric",
      render: (r) => (
        <span>
          {r.key_metric != null ? r.key_metric.toFixed(4) : "—"}
          {r.key_metric_name && (
            <span className="ml-1 text-muted-foreground">
              ({r.key_metric_name})
            </span>
          )}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge
          variant="outline"
          className={cn("font-mono text-xs", statusBadgeColor(r.status))}
        >
          {r.status.toUpperCase()}
        </Badge>
      ),
    },
  ];

  /* ---------- expanded detail ---------- */

  function ExpandedDetail({ model }: { model: ModelRecord }) {
    const detail = parseModelData(model.data);

    return (
      <div className="space-y-4 rounded-md border bg-card/50 p-4">
        {/* Training config */}
        {detail.training_config && (
          <div>
            <h4 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Training Config
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3 lg:grid-cols-4">
              {Object.entries(detail.training_config).map(([k, v]) => (
                <div key={k} className="rounded border p-2">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">
                    {k}
                  </div>
                  <div className="font-mono text-sm font-medium">
                    {String(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation metrics */}
        {detail.validation_metrics && (
          <div>
            <h4 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Validation Metrics
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3 lg:grid-cols-4">
              {Object.entries(detail.validation_metrics).map(([k, v]) => (
                <div key={k} className="rounded border p-2">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">
                    {k}
                  </div>
                  <div className="font-mono text-sm font-semibold">
                    {typeof v === "number" ? v.toFixed(4) : String(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature importance - top 10 horizontal bars */}
        {detail.feature_importance && detail.feature_importance.length > 0 && (
          <div>
            <h4 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Feature Importance (Top 10)
            </h4>
            <div className="space-y-1.5">
              {detail.feature_importance
                .sort((a, b) => b.importance - a.importance)
                .slice(0, 10)
                .map((f, i) => {
                  const maxImportance = detail.feature_importance![0].importance;
                  const pct =
                    maxImportance > 0
                      ? (f.importance / maxImportance) * 100
                      : 0;

                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-40 truncate font-mono text-xs text-muted-foreground">
                        {f.feature}
                      </span>
                      <div className="flex-1">
                        <div className="h-4 rounded-sm bg-muted">
                          <div
                            className="h-4 rounded-sm bg-primary/60"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-14 text-right font-mono text-xs">
                        {f.importance.toFixed(4)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!detail.training_config &&
          !detail.validation_metrics &&
          !detail.feature_importance && (
            <p className="text-sm text-muted-foreground">
              No detailed model data available.
            </p>
          )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-mono text-xl font-bold tracking-tight">
          MODEL REGISTRY
        </h1>
        <p className="text-sm text-muted-foreground">
          Inventory of trained models, metrics, and feature importance
        </p>
      </div>

      {/* Model inventory table */}
      <section className="space-y-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Model Inventory
        </h2>
        {models === null ? (
          <TableSkeleton />
        ) : (
          <div className="space-y-0">
            <DataTable<ModelRecord>
              columns={columns}
              data={models}
              onRowClick={toggleExpand}
              emptyMessage="No models found"
            />
            {/* Render expanded details below the table for the selected model */}
            {expandedId &&
              models.find((m) => m.id === expandedId) && (
                <div className="mt-2">
                  <ExpandedDetail
                    model={models.find((m) => m.id === expandedId)!}
                  />
                </div>
              )}
          </div>
        )}
      </section>

      {/* Model freshness section */}
      <section className="space-y-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Model Freshness
        </h2>
        {models === null ? (
          <FreshnessSkeleton />
        ) : models.length === 0 ? (
          <p className="text-sm text-muted-foreground">No models to display.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {models.map((m) => {
              const days = daysSince(m.train_date);
              const stale = days > 14;

              return (
                <Card
                  key={m.id}
                  className={cn(stale && "border-[var(--loss)]/40")}
                >
                  <CardHeader className="pb-1">
                    <CardTitle className="truncate font-mono text-sm">
                      {m.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">
                          Last trained
                        </div>
                        <div
                          className={cn(
                            "font-mono text-lg font-bold",
                            freshnessColor(days)
                          )}
                        >
                          {days}d ago
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-[10px]",
                          stale
                            ? "border-[var(--loss)]/50 bg-[var(--loss)]/10 text-[var(--loss)]"
                            : days <= 7
                              ? "border-[var(--win)]/50 bg-[var(--win)]/10 text-[var(--win)]"
                              : "border-yellow-500/50 bg-yellow-500/10 text-yellow-500"
                        )}
                      >
                        {freshnessLabel(days)}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {fmtDate(m.train_date)} &middot;{" "}
                      <span className="uppercase">{m.sport}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
