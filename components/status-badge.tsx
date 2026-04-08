import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { gateColor } from "@/lib/format";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-xs", gateColor(status), className)}
    >
      {status}
    </Badge>
  );
}
