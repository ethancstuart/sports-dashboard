"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
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

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface BrowseResult {
  table: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  totalRows: number;
  limit: number;
  offset: number;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  elapsed: number;
  error?: string;
}

interface SchemaOverview {
  tables: { table_name: string; row_count: string }[];
  schemas: Record<string, ColumnInfo[]>;
}

/* ---------- constants ---------- */

const SAMPLE_QUERIES = [
  {
    label: "Today's picks",
    sql: `SELECT strategy, sport, game_id, bet_side, edge, kelly_size, book_odds, predicted_value
FROM strategy_picks WHERE game_date = CURRENT_DATE ORDER BY edge DESC`,
  },
  {
    label: "Strategy P&L",
    sql: `SELECT strategy, sport,
  COUNT(*) AS bets,
  SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) AS wins,
  ROUND(SUM(CASE WHEN result='win' THEN 1.0 ELSE 0 END)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS win_pct,
  ROUND(SUM(pnl)::numeric, 2) AS pnl,
  ROUND(AVG(edge)::numeric * 100, 1) AS avg_edge_pct,
  ROUND(AVG(clv)::numeric, 4) AS avg_clv
FROM strategy_picks WHERE result IS NOT NULL
GROUP BY strategy, sport ORDER BY pnl DESC`,
  },
  {
    label: "CLV analysis",
    sql: `SELECT strategy,
  COUNT(*) AS bets,
  SUM(CASE WHEN clv > 0 THEN 1 ELSE 0 END) AS positive_clv,
  ROUND(AVG(clv)::numeric, 4) AS avg_clv,
  ROUND(AVG(CASE WHEN result='win' THEN 1.0 ELSE 0 END)::numeric * 100, 1) AS win_pct
FROM strategy_picks WHERE result IS NOT NULL AND clv IS NOT NULL
GROUP BY strategy ORDER BY avg_clv DESC`,
  },
  {
    label: "Model metrics",
    sql: `SELECT artifact_name,
  artifact_data->>'brier_score' AS brier,
  artifact_data->>'accuracy' AS accuracy,
  artifact_data->>'calibration_slope' AS cal_slope,
  artifact_data->>'calibration_method' AS cal_method,
  created_at
FROM pipeline_artifacts
WHERE artifact_type = 'model_metrics'
ORDER BY created_at DESC LIMIT 20`,
  },
  {
    label: "Odds coverage",
    sql: `SELECT sport, game_date, COUNT(DISTINCT game_id) AS games, COUNT(*) AS odds_rows
FROM odds GROUP BY sport, game_date ORDER BY game_date DESC LIMIT 20`,
  },
  {
    label: "Data freshness",
    sql: `SELECT 'games' AS tbl, MAX(game_date) AS latest FROM games
UNION ALL SELECT 'odds', MAX(game_date) FROM odds
UNION ALL SELECT 'strategy_picks', MAX(game_date) FROM strategy_picks
UNION ALL SELECT 'elo_ratings', MAX(as_of_date) FROM elo_ratings`,
  },
];

/* ---------- helpers ---------- */

function formatCell(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") {
    if (Number.isInteger(val)) return val.toLocaleString();
    return val.toFixed(4);
  }
  if (typeof val === "object") return JSON.stringify(val).slice(0, 120);
  return String(val);
}

function cellColor(val: unknown, col: string): string {
  if (val === null || val === undefined) return "text-muted-foreground/50";
  if (col === "result" && val === "win") return "text-[var(--win)]";
  if (col === "result" && val === "loss") return "text-[var(--loss)]";
  if (col === "pnl" && typeof val === "number") {
    return val > 0 ? "text-[var(--win)]" : val < 0 ? "text-[var(--loss)]" : "";
  }
  if (col === "edge" && typeof val === "number") {
    return val > 0.05 ? "text-[var(--win)]" : val < 0 ? "text-[var(--loss)]" : "";
  }
  return "";
}

/* ---------- components ---------- */

function ResultTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
}) {
  if (columns.length === 0) return null;
  return (
    <div className="max-h-[60vh] overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-[10px] uppercase text-muted-foreground w-10">
              #
            </TableHead>
            {columns.map((col) => (
              <TableHead
                key={col}
                className="font-mono text-[10px] uppercase text-muted-foreground whitespace-nowrap"
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i} className="hover:bg-muted/30">
              <TableCell className="font-mono text-[11px] text-muted-foreground/50 w-10">
                {i + 1}
              </TableCell>
              {columns.map((col) => (
                <TableCell
                  key={col}
                  className={cn(
                    "font-mono text-[11px] whitespace-nowrap max-w-[300px] truncate",
                    cellColor(row[col], col)
                  )}
                  title={formatCell(row[col])}
                >
                  {formatCell(row[col])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ---------- page ---------- */

export default function DataExplorerPage() {
  const [mode, setMode] = useState<"query" | "browse">("query");
  const [sql, setSql] = useState(SAMPLE_QUERIES[0].sql);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Browse state
  const [schema, setSchema] = useState<SchemaOverview | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [browseOffset, setBrowseOffset] = useState(0);

  // Load schema on mount
  useEffect(() => {
    fetch("/api/data/browse")
      .then((r) => r.json())
      .then((d) => setSchema(d))
      .catch(() => {});
  }, []);

  const runQuery = useCallback(async () => {
    setLoading(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const res = await fetch("/api/data/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQueryError(data.error ?? "Query failed");
      } else {
        setQueryResult(data);
      }
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [sql]);

  const browseTable = useCallback(
    async (table: string, offset = 0) => {
      setSelectedTable(table);
      setBrowseOffset(offset);
      setLoading(true);
      try {
        const res = await fetch(
          `/api/data/browse?table=${table}&limit=50&offset=${offset}`
        );
        const data = await res.json();
        setBrowseResult(data);
      } catch {
        setBrowseResult(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Keyboard shortcut: Ctrl+Enter to run query
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && mode === "query") {
        e.preventDefault();
        runQuery();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [runQuery, mode]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight">
            DATA EXPLORER
          </h1>
          <p className="text-sm text-muted-foreground">
            Query your data lake &middot; Browse tables &middot; Inspect models
          </p>
        </div>
        <div className="flex gap-1 rounded-md border p-1">
          <button
            onClick={() => setMode("query")}
            className={cn(
              "rounded px-3 py-1 font-mono text-xs transition-colors",
              mode === "query"
                ? "bg-[var(--primary)] text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            SQL QUERY
          </button>
          <button
            onClick={() => setMode("browse")}
            className={cn(
              "rounded px-3 py-1 font-mono text-xs transition-colors",
              mode === "browse"
                ? "bg-[var(--primary)] text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            TABLE BROWSER
          </button>
        </div>
      </div>

      {/* ═══ QUERY MODE ═══ */}
      {mode === "query" && (
        <>
          {/* Sample queries */}
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUERIES.map((q) => (
              <button
                key={q.label}
                onClick={() => setSql(q.sql)}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                  sql === q.sql
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* SQL Editor */}
          <Card>
            <CardContent className="p-0">
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                className="w-full resize-y rounded-t-lg border-0 bg-card p-4 font-mono text-sm text-foreground focus:outline-none focus:ring-0"
                rows={6}
                placeholder="SELECT * FROM strategy_picks LIMIT 10"
                spellCheck={false}
              />
              <div className="flex items-center justify-between border-t px-4 py-2">
                <span className="text-[10px] text-muted-foreground">
                  Ctrl+Enter to run &middot; Read-only (SELECT only) &middot;
                  Max 500 rows
                </span>
                <button
                  onClick={runQuery}
                  disabled={loading || !sql.trim()}
                  className={cn(
                    "rounded-md px-4 py-1.5 font-mono text-xs font-semibold transition-colors",
                    loading
                      ? "bg-muted text-muted-foreground"
                      : "bg-[var(--primary)] text-primary-foreground hover:opacity-90"
                  )}
                >
                  {loading ? "RUNNING..." : "RUN QUERY"}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Query Error */}
          {queryError && (
            <div className="rounded-md border border-[var(--loss)]/30 bg-[var(--loss)]/10 px-4 py-2 font-mono text-sm text-[var(--loss)]">
              {queryError}
            </div>
          )}

          {/* Query Results */}
          {queryResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-mono">
                  {queryResult.rowCount} row{queryResult.rowCount !== 1 && "s"}
                  {queryResult.truncated && " (truncated)"}
                </span>
                <span className="font-mono">{queryResult.elapsed}ms</span>
                <span className="font-mono">
                  {queryResult.columns.length} column
                  {queryResult.columns.length !== 1 && "s"}
                </span>
              </div>
              <ResultTable
                columns={queryResult.columns}
                rows={queryResult.rows}
              />
            </div>
          )}
        </>
      )}

      {/* ═══ BROWSE MODE ═══ */}
      {mode === "browse" && (
        <div className="grid grid-cols-[240px_1fr] gap-4">
          {/* Table list */}
          <div className="space-y-2">
            <h3 className="font-mono text-xs font-semibold uppercase text-muted-foreground">
              Tables
            </h3>
            <div className="space-y-0.5">
              {schema?.tables
                .filter((t) => !t.table_name.startsWith("pg_"))
                .map((t) => {
                  const name = t.table_name.replace("public.", "");
                  const active = selectedTable === name;
                  return (
                    <button
                      key={t.table_name}
                      onClick={() => browseTable(name)}
                      className={cn(
                        "flex w-full items-center justify-between rounded px-2 py-1.5 text-left font-mono text-xs transition-colors",
                        active
                          ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <span className="truncate">{name}</span>
                      <span className="text-[10px] opacity-50">
                        {parseInt(t.row_count).toLocaleString()}
                      </span>
                    </button>
                  );
                })}
            </div>

            {/* Schema inspector */}
            {selectedTable && schema?.schemas[selectedTable] && (
              <div className="mt-4 space-y-2">
                <h3 className="font-mono text-xs font-semibold uppercase text-muted-foreground">
                  Schema: {selectedTable}
                </h3>
                <div className="rounded-md border">
                  <Table>
                    <TableBody>
                      {schema.schemas[selectedTable].map((col) => (
                        <TableRow key={col.column_name}>
                          <TableCell className="font-mono text-[10px] py-1 px-2">
                            {col.column_name}
                          </TableCell>
                          <TableCell className="font-mono text-[10px] py-1 px-2 text-muted-foreground">
                            {col.data_type}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          {/* Table data */}
          <div className="space-y-2">
            {browseResult ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    {browseResult.totalRows.toLocaleString()} total rows
                    {browseResult.offset > 0 &&
                      ` | Showing ${browseResult.offset + 1}-${
                        browseResult.offset + browseResult.rows.length
                      }`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        browseTable(
                          browseResult.table,
                          Math.max(0, browseOffset - 50)
                        )
                      }
                      disabled={browseOffset === 0}
                      className="rounded border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      PREV
                    </button>
                    <button
                      onClick={() =>
                        browseTable(browseResult.table, browseOffset + 50)
                      }
                      disabled={
                        browseOffset + 50 >= browseResult.totalRows
                      }
                      className="rounded border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      NEXT
                    </button>
                  </div>
                </div>
                <ResultTable
                  columns={browseResult.columns.map((c) => c.column_name)}
                  rows={browseResult.rows}
                />
              </>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Select a table to browse
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
