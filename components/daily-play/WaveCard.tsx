"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PickCard } from "./PickCard";
import type { SequencerWave, WaveId } from "@/lib/sequencer";

interface WaveCardProps {
  wave: SequencerWave;
  isActive?: boolean;
  isPast?: boolean;
}

const WAVE_LABELS: Record<WaveId, string> = {
  W1: "Morning Wave",
  W2: "Evening Wave",
  W3: "Late Wave",
};

function fmtIssueTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function WaveCard({ wave, isActive = false, isPast = false }: WaveCardProps) {
  const label = WAVE_LABELS[wave.wave_id];
  const issueTime = fmtIssueTime(wave.issue_time_iso);
  const hasPicks = wave.picks.length > 0;
  const isWarning = wave.notes.includes("below threshold");

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all",
        isActive && "ring-2 ring-[var(--bet)] shadow-lg",
        isPast && "opacity-60",
      )}
    >
      <CardHeader
        className={cn(
          "flex flex-row items-center justify-between border-b py-3 px-4",
          isActive
            ? "bg-[var(--bet)]/10"
            : isPast
              ? "bg-muted/30"
              : "bg-muted/10",
        )}
      >
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-xs">
            {wave.wave_id}
          </Badge>
          <CardTitle className="text-base">
            {label}
          </CardTitle>
          {isActive && (
            <Badge className="bg-[var(--bet)] text-white text-[10px] tracking-wider">
              ACTIVE NOW
            </Badge>
          )}
          {isPast && (
            <Badge variant="outline" className="text-[10px] tracking-wider opacity-60">
              CLOSED
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {issueTime} ET
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4">
        {!hasPicks ? (
          <div className="py-6 text-center text-sm text-muted-foreground italic">
            No edge clears the bar — sit out.
          </div>
        ) : (
          <>
            {isWarning && (
              <div className="rounded-md border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                ⚠ {wave.notes}
              </div>
            )}
            {wave.picks.map((pick) => (
              <PickCard
                key={pick.pick_id}
                pick={pick}
                stake={wave.stake_per_pick}
              />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
