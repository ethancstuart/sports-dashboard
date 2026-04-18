"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Mark-Placed button — the actual capture end of the Decision Ledger.
 *
 * Without line_taken and odds_taken from the book the user actually used,
 * realized CLV is unmeasurable and the edge dashboard is a model
 * telemetry layer rather than a bettor P&L system. This button closes
 * that loop.
 *
 * Keyboard-friendly: Tab through fields, Enter submits. Mobile-first:
 * the dialog is full-screen on narrow viewports.
 *
 * Optimistic-UI-style: no refetch after success — the row's own
 * result column will update on the next settlement run, and the
 * placement feed is a separate page.
 */

const BOOKS = [
  { value: "draftkings", label: "DraftKings" },
  { value: "fanduel", label: "FanDuel" },
  { value: "pinnacle", label: "Pinnacle" },
  { value: "caesars", label: "Caesars" },
  { value: "betmgm", label: "BetMGM" },
  { value: "circa", label: "Circa" },
  { value: "betrivers", label: "BetRivers" },
  { value: "other", label: "Other" },
];

interface Props {
  pickId: number;
  defaultOdds?: number | null;
  defaultLine?: number | null;
  strategyLabel?: string;
  /** Disable the button (e.g. for picks already placed) */
  disabled?: boolean;
  onPlaced?: (placementId: number) => void;
}

export function MarkPlacedButton({
  pickId,
  defaultOdds,
  defaultLine,
  strategyLabel,
  disabled,
  onPlaced,
}: Props) {
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState<string | null>("draftkings");
  const [stake, setStake] = useState<string>("");
  const [lineTaken, setLineTaken] = useState<string>(
    defaultLine != null ? String(defaultLine) : ""
  );
  const [oddsTaken, setOddsTaken] = useState<string>(
    defaultOdds != null ? String(defaultOdds) : ""
  );
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "done">(
    "idle"
  );
  const [errMsg, setErrMsg] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrMsg("");
    try {
      const stakeNum = Number(stake);
      if (!Number.isFinite(stakeNum) || stakeNum <= 0) {
        throw new Error("Stake must be a positive number");
      }
      const res = await fetch("/api/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pick_id: pickId,
          book: book ?? "other",
          stake: stakeNum,
          line_taken: lineTaken ? Number(lineTaken) : null,
          odds_taken: oddsTaken ? Number(oddsTaken) : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const body = await res.json();
      setStatus("done");
      onPlaced?.(body.placement_id);
      // Auto-close after a short confirmation flash
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
        setStake("");
        setNotes("");
      }, 600);
    } catch (err) {
      setStatus("error");
      setErrMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={disabled}
        className="inline-flex h-7 items-center justify-center rounded-md border border-input bg-background px-2.5 text-[11px] font-semibold uppercase tracking-wider shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
      >
        Mark Placed
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Record placed bet</DialogTitle>
          <DialogDescription>
            {strategyLabel
              ? `Pick ${pickId} · ${strategyLabel}`
              : `Pick ${pickId}`}
            <span className="block mt-1 text-[11px] text-muted-foreground">
              Line and odds captured here drive realized CLV vs the
              model&apos;s hypothetical CLV. If your book moved between
              pick-time and placement, enter what you actually got.
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="book">Book</Label>
            <Select value={book} onValueChange={setBook}>
              <SelectTrigger id="book">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOKS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="stake">Stake ($)</Label>
              <Input
                id="stake"
                required
                inputMode="decimal"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder="20"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="odds">Odds taken</Label>
              <Input
                id="odds"
                inputMode="numeric"
                value={oddsTaken}
                onChange={(e) => setOddsTaken(e.target.value)}
                placeholder="-110"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="line">Line taken (spread / total)</Label>
            <Input
              id="line"
              inputMode="decimal"
              value={lineTaken}
              onChange={(e) => setLineTaken(e.target.value)}
              placeholder="(leave blank for moneyline)"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="boosted price, parlay leg, etc."
            />
          </div>
          {status === "error" && (
            <div className="rounded border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
              {errMsg}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={status === "submitting"}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={status === "submitting"}>
              {status === "submitting"
                ? "Saving…"
                : status === "done"
                ? "Saved ✓"
                : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
