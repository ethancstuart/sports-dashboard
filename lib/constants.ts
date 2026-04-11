/** Starting bankroll — single source of truth */
export const BANKROLL_BASE = 200;

/** Dollars per unit */
export const UNIT_SIZE = 20;

/** Get today's date in local timezone (not UTC) */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
