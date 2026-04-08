import { cn } from "@/lib/utils";

interface SparklineChartProps {
  data: number[]; // 0 or 1 values
  className?: string;
  height?: number;
  color?: "green" | "yellow" | "red" | "auto";
  uptime?: number;
}

export function SparklineChart({
  data,
  className,
  height = 24,
  color = "auto",
  uptime,
}: SparklineChartProps) {
  const resolvedColor =
    color === "auto"
      ? uptime != null
        ? uptime >= 99
          ? "green"
          : uptime >= 95
          ? "yellow"
          : "red"
        : "green"
      : color;

  const colorMap = {
    green: { bar: "bg-emerald-500", inactive: "bg-emerald-500/15" },
    yellow: { bar: "bg-yellow-500", inactive: "bg-yellow-500/15" },
    red: { bar: "bg-red-500", inactive: "bg-red-500/15" },
  };

  const cols = colorMap[resolvedColor];

  return (
    <div
      className={cn("flex items-end gap-0.5", className)}
      style={{ height }}
      title={`Last ${data.length} checks`}
    >
      {data.map((val, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 rounded-sm transition-all duration-300 sparkline-bar",
            val === 1 ? cols.bar : cols.inactive
          )}
          style={{ height: val === 1 ? "100%" : "30%" }}
        />
      ))}
    </div>
  );
}
