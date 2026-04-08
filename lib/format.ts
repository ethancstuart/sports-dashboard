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
