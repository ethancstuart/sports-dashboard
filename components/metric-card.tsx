import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  className?: string;
}

export function MetricCard({ label, value, subtext, className }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className={cn("mt-1 font-mono text-2xl font-bold", className)}>
          {value}
        </div>
        {subtext && (
          <div className="mt-1 text-xs text-muted-foreground">{subtext}</div>
        )}
      </CardContent>
    </Card>
  );
}
