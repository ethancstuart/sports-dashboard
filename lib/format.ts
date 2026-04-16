/** Format a number as currency */
export function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return n < 0
    ? `-$${Math.abs(n).toFixed(2)}`
    : `$${n.toFixed(2)}`;
}

/** Format a number as +/- dollar P&L (1 unit = $20) */
export function fmtUnits(n: number | null | undefined): string {
  if (n == null) return "—";
  const dollars = n * 20;
  return dollars < 0
    ? `-$${Math.abs(dollars).toFixed(0)}`
    : `+$${dollars.toFixed(0)}`;
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

/** Human-readable strategy label (e.g. "MLB Moneyline"). */
export function displayStrategy(strategy: string | null | undefined): string {
  if (!strategy) return "—";
  const map: Record<string, string> = {
    mlb_ml: "MLB Moneyline",
    mlb_f5_under: "MLB F5 — Under",
    mlb_f5_over: "MLB F5 — Over",
    mlb_nrfi: "MLB NRFI",
    mlb_yrfi: "MLB YRFI",
    mlb_total_over: "MLB Total — Over",
    mlb_total_under: "MLB Total — Under",
    mlb_spread: "MLB Run Line",
    nba_ml: "NBA Moneyline",
    nba_spread: "NBA Spread",
    nba_total_over: "NBA Total — Over",
    nba_total_under: "NBA Total — Under",
    nba_1q_spread: "NBA Q1 Spread",
    nba_q1_spread: "NBA Q1 Spread",
    nba_1h_spread: "NBA 1H Spread",
    nba_h1_spread: "NBA 1H Spread",
    nba_first_10: "NBA First to 10",
    nba_first_to_10: "NBA First to 10",
    nba_first_20: "NBA First to 20",
    nba_first_to_20: "NBA First to 20",
    nba_totals: "NBA Total",
    nba_player_points: "NBA Player — Points",
    nba_player_assists: "NBA Player — Assists",
    nba_player_rebounds: "NBA Player — Rebounds",
    nfl_ml: "NFL Moneyline",
    nfl_spread: "NFL Spread",
    nfl_totals: "NFL Total",
    nfl_total_over: "NFL Total — Over",
    nfl_total_under: "NFL Total — Under",
    nfl_q1_spread: "NFL Q1 Spread",
    nfl_h1_spread: "NFL 1H Spread",
    nfl_first_10: "NFL First to 10",
  };
  return map[strategy] ?? strategy.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Short tag like "MLB ML", "F5 Under", "Q1 Spread" — for chips. */
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
    case "mlb_nrfi": return "NRFI";
    case "mlb_yrfi": return "YRFI";
    case "mlb_f5_under": return "F5 Under";
    case "mlb_f5_over": return "F5 Over";
    case "mlb_ml":
    case "nba_ml":
    case "nfl_ml":
      return team ? `${team} ML` : "ML";
    case "nba_spread":
    case "nfl_spread":
    case "mlb_spread":
      return team ? `${team} Spread` : "Spread";
    case "nba_totals":
    case "nfl_totals":
      return side === "over" ? "Over" : side === "under" ? "Under" : "Total";
    case "nba_1q_spread":
    case "nba_q1_spread":
      return team ? `${team} Q1` : "Q1 Spread";
    case "nba_1h_spread":
    case "nba_h1_spread":
      return team ? `${team} 1H` : "1H Spread";
    case "nba_first_10":
    case "nba_first_to_10":
      return team ? `${team} First 10` : "First to 10";
    case "nba_first_20":
    case "nba_first_to_20":
      return team ? `${team} First 20` : "First to 20";
    default:
      return strategy.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/** Plain-English "bet this" instruction. */
export function betInstruction(
  strategy: string,
  betSide: string | null,
  home: string | null,
  away: string | null
): string {
  const side = (betSide ?? "").toLowerCase();
  const team = side === "home" ? home : side === "away" ? away : null;

  if (/_ml$/.test(strategy) && team) return `Bet ${team} Moneyline`;
  if (strategy === "mlb_f5_under") return "Bet Under — First 5 Innings Total";
  if (strategy === "mlb_f5_over") return "Bet Over — First 5 Innings Total";
  if (strategy === "mlb_nrfi") return "Bet NO run scored in 1st inning";
  if (strategy === "mlb_yrfi") return "Bet YES run scored in 1st inning";
  if (/_total_over$/.test(strategy)) return "Bet Over — Full Game Total";
  if (/_total_under$/.test(strategy)) return "Bet Under — Full Game Total";
  if (strategy === "nba_totals" || strategy === "nfl_totals") {
    if (side === "over") return "Bet Over — Full Game Total";
    if (side === "under") return "Bet Under — Full Game Total";
  }
  if (/_spread$/.test(strategy) && team) {
    const market = strategy.includes("q1") || strategy.includes("1q")
      ? "1st Quarter Spread"
      : strategy.includes("h1") || strategy.includes("1h")
        ? "1st Half Spread"
        : "Spread";
    return `Bet ${team} ${market}`;
  }
  if ((strategy === "nba_first_10" || strategy === "nba_first_to_10" || strategy === "nfl_first_10") && team) {
    return `Bet ${team} First to 10`;
  }
  if ((strategy === "nba_first_20" || strategy === "nba_first_to_20") && team) {
    return `Bet ${team} First to 20`;
  }
  if (strategy.startsWith("nba_player_") && (side === "over" || side === "under")) {
    const metric = strategy.replace("nba_player_", "");
    return `Bet ${side[0].toUpperCase() + side.slice(1)} — ${metric}`;
  }
  return `Bet ${side || "—"} · ${displayStrategy(strategy)}`;
}

/** Confidence tier from edge. */
export function edgeTier(edge: number | null | undefined): "BET" | "LEAN" | "WATCH" {
  const e = (edge ?? 0) * 100;
  if (e >= 8) return "BET";
  if (e >= 4) return "LEAN";
  return "WATCH";
}

/** Minimum win-rate needed to break even at given American odds. */
export function breakevenWR(americanOdds: number | null | undefined): number {
  if (americanOdds == null) return 0.524; // default -110
  if (americanOdds >= 100) return 100 / (americanOdds + 100);
  return -americanOdds / (-americanOdds + 100);
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
  nba_1q_spread: 1,
  nba_first_10: 2,
  nba_first_20: 3,
  nba_spread: 4,
  nba_1h_spread: 5,
  nba_totals: 6,
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
