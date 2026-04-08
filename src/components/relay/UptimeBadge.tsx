import { cn } from "@/lib/utils";
import { uptimeColor, uptimeLabel } from "@/lib/utils";

interface UptimeBadgeProps {
  uptime: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function UptimeBadge({ uptime, size = "md", showLabel = false }: UptimeBadgeProps) {
  const color = uptimeColor(uptime);

  const colorClasses = {
    green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    yellow: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25",
    red: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25",
  };

  const dotClasses = {
    green: "bg-emerald-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
  };

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
    lg: "text-sm px-2.5 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        colorClasses[color],
        sizeClasses[size]
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotClasses[color], color === "green" && "animate-pulse")} />
      <span>{uptime.toFixed(1)}%</span>
      {showLabel && <span className="opacity-70">{uptimeLabel(uptime)}</span>}
    </span>
  );
}

interface OnlineIndicatorProps {
  isOnline: boolean;
  className?: string;
}

export function OnlineIndicator({ isOnline, className }: OnlineIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2 py-0.5 border",
        isOnline
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
        )}
      />
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}
