"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  fmtUnits,
  fmtPct,
  fmtOdds,
  pnlColor,
  fmtDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */

interface Prediction {
  game_id: string;
  game_date: string;
  home: string;
  away: string;
  strategy: string;
  side: string;
  edge: number;
  result: string | null;
  pnl: number | null;
  [key: string]: unknown;
}

interface SubgamePrediction {
  label: string;
  predicted: number;
  actual: number | null;
  edge: number;
  [key: string]: unknown;
}

interface AuditDetail {
  game_id: string;
  model_name: string;
  model_version: string;
  predicted_value: number;
  edge: number;
  kelly_size: number;
  book_odds_at_prediction: number;
  closing_line: number | null;
  actual_outcome: string | null;
  pnl: number | null;
  subgame_predictions: SubgamePrediction[] | null;
  [key: string]: unknown;
}

/* ---------- strategies list ---------- */

const STRATEGIES = [
  "All",
  "nfl_spread",
  "nfl_totals",
  "nfl_moneyline",
  "nfl_player_props",
  "mlb_spread",
  "mlb_totals",
  "mlb_moneyline",
  "nba_spread",
  "nba_totals",
  "nba_moneyline",
  "nba_player_props",
];

/* ---------- helpers ---------- */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- skeleton ---------- */

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/* ---------- page ---------- */

export default function PredictionAuditPage() {
  const [date, setDate] = useState(today());
  const [gameIdFilter, setGameIdFilter] = useState("");
  const [strategyFilter, setStrategyFilter] = useState("All");
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedGame, setSelectedGame] = useState<Prediction | null>(null);
  const [auditDetail, setAuditDetail] = useState<AuditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  /* Fetch predictions for selected date */
  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/picks?date=${date}`);
      const data: Prediction[] = await res.json();
      setPredictions(data);
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  /* Fetch audit detail for a game */
  async function openDetail(row: Prediction) {
    setSelectedGame(row);
    setDialogOpen(true);
    setDetailLoading(true);
    setAuditDetail(null);
    try {
      const res = await fetch(`/api/audit/${row.game_id}`);
      const data: AuditDetail = await res.json();
      setAuditDetail(data);
    } catch {
      setAuditDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  /* Filtered predictions */
  const filtered = (predictions ?? []).filter((p) => {
    if (gameIdFilter && !p.game_id.toLowerCase().includes(gameIdFilter.toLowerCase())) {
      return false;
    }
    if (strategyFilter !== "All" && p.strategy !== strategyFilter) {
      return false;
    }
    return true;
  });

  /* ---------- column defs ---------- */

  const columns: Column<Prediction>[] = [
    {
      key: "game_date",
      header: "Game Date",
      render: (r) => fmtDate(r.game_date),
    },
    {
      key: "game",
      header: "Game",
      render: (r) => (
        <span className="whitespace-nowrap">
          {r.home} <span className="text-muted-foreground">vs</span> {r.away}
        </span>
      ),
    },
    { key: "strategy", header: "Strategy" },
    { key: "side", header: "Side" },
    {
      key: "edge",
      header: "Edge%",
      render: (r) => fmtPct(r.edge),
    },
    {
      key: "result",
      header: "Result",
      render: (r) =>
        r.result ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
              r.result === "win"
                ? "bg-[var(--win)]/20 text-[var(--win)]"
                : r.result === "loss"
                  ? "bg-[var(--loss)]/20 text-[var(--loss)]"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {r.result.toUpperCase()}
          </span>
        ) : (
          <span className="text-muted-foreground">PENDING</span>
        ),
    },
    {
      key: "pnl",
      header: "P&L",
      render: (r) => (
        <span className={pnlColor(r.pnl)}>{fmtUnits(r.pnl)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-mono text-xl font-bold tracking-tight">
          PREDICTION AUDIT
        </h1>
        <p className="text-sm text-muted-foreground">
          Review predictions, model outputs, and line movements
        </p>
      </div>

      {/* Search bar */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs uppercase text-muted-foreground">
              Game ID
            </label>
            <Input
              placeholder="Search game ID..."
              value={gameIdFilter}
              onChange={(e) => setGameIdFilter(e.target.value)}
              className="h-8 w-48 font-mono text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs uppercase text-muted-foreground">
              Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 w-40 font-mono text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs uppercase text-muted-foreground">
              Strategy
            </label>
            <Select value={strategyFilter} onValueChange={(v) => setStrategyFilter(v ?? "All")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRATEGIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Predictions table */}
      <section className="space-y-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Predictions &middot; {fmtDate(date)}
        </h2>
        {loading || predictions === null ? (
          <TableSkeleton />
        ) : (
          <DataTable<Prediction>
            columns={columns}
            data={filtered}
            onRowClick={openDetail}
            emptyMessage="No predictions found"
          />
        )}
      </section>

      {/* Detail dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">
              {selectedGame
                ? `${selectedGame.home} vs ${selectedGame.away}`
                : "Prediction Detail"}
            </DialogTitle>
            <DialogDescription>
              {selectedGame
                ? `${selectedGame.strategy} | ${fmtDate(selectedGame.game_date)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          ) : auditDetail ? (
            <div className="space-y-4 py-2">
              {/* Model info */}
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {auditDetail.model_name}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  v{auditDetail.model_version}
                </span>
              </div>

              {/* Key metrics grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="font-mono text-xs uppercase text-muted-foreground">
                    Predicted Value
                  </div>
                  <div className="font-mono font-semibold">
                    {auditDetail.predicted_value?.toFixed(3) ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xs uppercase text-muted-foreground">
                    Edge
                  </div>
                  <div className="font-mono font-semibold">
                    {fmtPct(auditDetail.edge)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xs uppercase text-muted-foreground">
                    Kelly Size
                  </div>
                  <div className="font-mono font-semibold">
                    {fmtPct(auditDetail.kelly_size)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xs uppercase text-muted-foreground">
                    Book Odds (Prediction)
                  </div>
                  <div className="font-mono font-semibold">
                    {fmtOdds(auditDetail.book_odds_at_prediction)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xs uppercase text-muted-foreground">
                    Closing Line
                  </div>
                  <div className="font-mono font-semibold">
                    {fmtOdds(auditDetail.closing_line)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xs uppercase text-muted-foreground">
                    CLV
                  </div>
                  <div className="font-mono font-semibold">
                    {auditDetail.closing_line != null &&
                    auditDetail.book_odds_at_prediction != null
                      ? `${(
                          auditDetail.book_odds_at_prediction -
                          auditDetail.closing_line
                        ).toFixed(1)} pts`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Outcome */}
              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs uppercase text-muted-foreground">
                      Actual Outcome
                    </div>
                    <div className="mt-1 font-mono text-sm font-semibold">
                      {auditDetail.actual_outcome
                        ? auditDetail.actual_outcome.toUpperCase()
                        : "PENDING"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs uppercase text-muted-foreground">
                      P&L
                    </div>
                    <div
                      className={cn(
                        "mt-1 font-mono text-lg font-bold",
                        pnlColor(auditDetail.pnl)
                      )}
                    >
                      {fmtUnits(auditDetail.pnl)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Subgame predictions */}
              {auditDetail.subgame_predictions &&
                auditDetail.subgame_predictions.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Subgame Predictions
                    </h3>
                    <div className="rounded-md border">
                      <div className="grid grid-cols-4 gap-2 border-b p-2 text-xs font-mono uppercase text-muted-foreground">
                        <span>Label</span>
                        <span>Predicted</span>
                        <span>Actual</span>
                        <span>Edge</span>
                      </div>
                      {auditDetail.subgame_predictions.map((sg, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-4 gap-2 border-b p-2 font-mono text-sm last:border-0"
                        >
                          <span>{sg.label}</span>
                          <span>{sg.predicted?.toFixed(3) ?? "—"}</span>
                          <span>
                            {sg.actual != null ? sg.actual.toFixed(3) : "—"}
                          </span>
                          <span>{fmtPct(sg.edge)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              No audit data available for this game.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
