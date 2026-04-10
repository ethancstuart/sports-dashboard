/** Format a number as currency */
export function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return n < 0
    ? `-$${Math.abs(n).toFixed(2)}`
    : `$${n.toFixed(2)}`;
}

/** Format a number as +/- units */
export function fmtUnits(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}u`;
}

/** Format percentage */
export function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(decimals)}%`;
}

/** Format American odds */
export function fmtOdds(n: number | null | undefined): string {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : `${n}`;
}

/** Format P&L with color class */
export function pnlColor(n: number | null | undefined): string {
  if (n == null) return "text-muted-foreground";
  if (n > 0) return "text-[var(--win)]";
  if (n < 0) return "text-[var(--loss)]";
  return "text-muted-foreground";
}

/** Format a date string to readable */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Human-readable bet label from strategy + side + teams */
export function formatBet(
  strategy: string,
  betSide: string | null,
  home: string | null,
  away: string | null
): string {
  const side = (betSide ?? "").toLowerCase();
  const team = side === "home" || side === "home_ml"
    ? (home || null)
    : side === "away" || side === "away_ml"
      ? (away || null)
      : null;

  switch (strategy) {
    case "mlb_nrfi":
      return "NRFI";
    case "mlb_yrfi":
      return "YRFI";
    case "mlb_f5_under":
      return "F5 Under";
    case "mlb_ml":
      return team ? `${team} ML` : "ML";
    case "nba_ml":
      return team ? `${team} ML` : "ML";
    case "nba_spread":
      return team ? `${team} Spread` : "Spread";
    case "nba_totals":
      return side === "over" ? "Over" : side === "under" ? "Under" : "Total";
    case "nfl_ml":
      return team ? `${team} ML` : "ML";
    case "nfl_spread":
      return team ? `${team} Spread` : "Spread";
    case "nfl_totals":
      return side === "over" ? "Over" : side === "under" ? "Under" : "Total";
    default:
      // Fallback: clean up strategy name
      return strategy.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/** Tier label based on edge and kelly */
export function getTier(edge: number | null, kelly: number | null): "ACTIONABLE" | "TRACKING" {
  if (edge != null && kelly != null && kelly > 0.005 && edge > 0.02) return "ACTIONABLE";
  return "TRACKING";
}

/** Sport-specific sort order for strategies */
const STRATEGY_ORDER: Record<string, number> = {
  mlb_nrfi: 0,
  mlb_yrfi: 1,
  mlb_f5_under: 2,
  mlb_ml: 3,
  nba_ml: 0,
  nba_spread: 1,
  nba_totals: 2,
  nfl_ml: 0,
  nfl_spread: 1,
  nfl_totals: 2,
};

export function strategySort(a: string, b: string): number {
  return (STRATEGY_ORDER[a] ?? 99) - (STRATEGY_ORDER[b] ?? 99);
}

/** Strategy status badge color */
export function gateColor(status: string): string {
  switch (status) {
    case "CONTINUE":
    case "LIVE":
      return "bg-[var(--live)]/20 text-[var(--live)] border-[var(--live)]/30";
    case "MONITOR":
    case "PAUSED":
      return "bg-[var(--paused)]/20 text-[var(--paused)] border-[var(--paused)]/30";
    case "KILL":
    case "KILLED":
      return "bg-[var(--killed)]/20 text-[var(--killed)] border-[var(--killed)]/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}
