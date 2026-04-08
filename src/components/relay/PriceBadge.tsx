import { cn } from "@/lib/utils";
import { DollarSign, Unlock } from "lucide-react";
import type { RelayRecord } from "@/types/relay";
import { getMinPrice } from "@/lib/utils";

interface PriceBadgeProps {
  relay: RelayRecord;
  size?: "sm" | "md";
}

export function PriceBadge({ relay, size = "sm" }: PriceBadgeProps) {
  const isFree = relay.isFree;
  const minPrice = getMinPrice(relay);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1",
        isFree
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      )}
    >
      {isFree ? (
        <>
          <Unlock className={size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />
          Free
        </>
      ) : (
        <>
          <DollarSign className={size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />
          {minPrice}
        </>
      )}
    </span>
  );
}
