import { cn } from "@/lib/utils";
import type { UseCaseTag } from "@/types/relay";
import {
  Globe, Image, Video, Cloud, Lock, Zap, ShieldCheck, Users, FileText,
  ShoppingBag, Gamepad2, EyeOff, Archive, Inbox, MessageCircle, Coins,
} from "lucide-react";

const USE_CASE_CONFIG: Record<UseCaseTag, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  General: { icon: Globe, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  Images: { icon: Image, color: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20" },
  Video: { icon: Video, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  Blossom: { icon: Cloud, color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" },
  "Paid Access": { icon: Lock, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  "High Performance": { icon: Zap, color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
  "Censorship Resistant": { icon: ShieldCheck, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  Communities: { icon: Users, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  "Long Form": { icon: FileText, color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  Marketplace: { icon: ShoppingBag, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  Gaming: { icon: Gamepad2, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  Privacy: { icon: EyeOff, color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" },
  Archive: { icon: Archive, color: "bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20" },
  Inbox: { icon: Inbox, color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20" },
  DMs: { icon: MessageCircle, color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" },
  Zaps: { icon: Coins, color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
};

interface UseCaseBadgeProps {
  tag: UseCaseTag;
  size?: "sm" | "md";
  onClick?: () => void;
  active?: boolean;
}

export function UseCaseBadge({ tag, size = "sm", onClick, active }: UseCaseBadgeProps) {
  const config = USE_CASE_CONFIG[tag] ?? { icon: Globe, color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20" };
  const Icon = config.icon;

  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium transition-all",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1",
        config.color,
        onClick && "cursor-pointer hover:opacity-80 hover:scale-105",
        active && "ring-2 ring-primary/50"
      )}
    >
      <Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {tag}
    </span>
  );
}
