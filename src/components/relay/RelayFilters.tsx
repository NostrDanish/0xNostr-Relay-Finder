import { useState } from "react";
import { Filter, X, ChevronDown, ShieldCheck, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UseCaseBadge } from "./UseCaseBadge";
import { USE_CASE_OPTIONS, COUNTRIES } from "@/data/relays";
import type { UseCaseTag, VoteTag } from "@/types/relay";
import { ALL_VOTE_TAGS } from "@/types/relay";
import { cn } from "@/lib/utils";

export type RelayFiltersState = {
  pricing: "any" | "free" | "paid";
  minUptime: number;
  countryCodes: string[];
  useCases: UseCaseTag[];
  communityTags: VoteTag[];
  onlineOnly: boolean;
  blossomOnly: boolean;
  nip66Only: boolean;
  sortBy: "uptime" | "score" | "alpha" | "newest" | "popular" | "votes";
};

export const DEFAULT_FILTERS: RelayFiltersState = {
  pricing: "any",
  minUptime: 0,
  countryCodes: [],
  useCases: [],
  communityTags: [],
  onlineOnly: false,
  blossomOnly: false,
  nip66Only: false,
  sortBy: "uptime",
};

interface RelayFiltersProps {
  filters: RelayFiltersState;
  onChange: (f: RelayFiltersState) => void;
  resultCount: number;
}

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold py-2 hover:text-primary transition-colors">
        {title}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pb-3 space-y-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RelayFilters({ filters, onChange, resultCount }: RelayFiltersProps) {
  const hasActiveFilters =
    filters.pricing !== "any" ||
    filters.minUptime > 0 ||
    filters.countryCodes.length > 0 ||
    filters.useCases.length > 0 ||
    filters.communityTags.length > 0 ||
    filters.onlineOnly ||
    filters.blossomOnly ||
    filters.nip66Only;

  const activeCount = [
    filters.pricing !== "any" ? 1 : 0,
    filters.minUptime > 0 ? 1 : 0,
    filters.countryCodes.length,
    filters.useCases.length,
    filters.communityTags.length,
    filters.onlineOnly ? 1 : 0,
    filters.blossomOnly ? 1 : 0,
    filters.nip66Only ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const resetFilters = () => onChange({ ...DEFAULT_FILTERS, sortBy: filters.sortBy });

  const toggleUseCase = (uc: UseCaseTag) => {
    const next = filters.useCases.includes(uc)
      ? filters.useCases.filter((u) => u !== uc)
      : [...filters.useCases, uc];
    onChange({ ...filters, useCases: next });
  };

  const toggleCommunityTag = (tag: VoteTag) => {
    const next = filters.communityTags.includes(tag)
      ? filters.communityTags.filter((t) => t !== tag)
      : [...filters.communityTags, tag];
    onChange({ ...filters, communityTags: next });
  };

  const toggleCountry = (code: string) => {
    const next = filters.countryCodes.includes(code)
      ? filters.countryCodes.filter((c) => c !== code)
      : [...filters.countryCodes, code];
    onChange({ ...filters, countryCodes: next });
  };

  return (
    <aside className="w-full space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Filters</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs px-1.5">
              {activeCount}
            </Badge>
          )}
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={resetFilters}>
            <X className="w-3 h-3" />
            Reset
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Showing <strong className="text-foreground">{resultCount}</strong> relays
      </p>

      <div className="divide-y divide-border/50">
        {/* Pricing */}
        <FilterSection title="Pricing">
          <div className="flex gap-1.5 flex-wrap">
            {(["any", "free", "paid"] as const).map((p) => (
              <button
                key={p}
                onClick={() => onChange({ ...filters, pricing: p })}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border font-medium transition-all capitalize",
                  filters.pricing === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                {p === "any" ? "All" : p}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Status + special flags */}
        <FilterSection title="Status & Features" defaultOpen={true}>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => onChange({ ...filters, onlineOnly: !filters.onlineOnly })}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border font-medium transition-all flex items-center gap-1.5 w-fit",
                filters.onlineOnly
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "border-border text-muted-foreground hover:border-emerald-500/30 hover:text-foreground"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", filters.onlineOnly ? "bg-emerald-500" : "bg-muted-foreground")} />
              Online only
            </button>
            <button
              onClick={() => onChange({ ...filters, blossomOnly: !filters.blossomOnly })}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border font-medium transition-all flex items-center gap-1.5 w-fit",
                filters.blossomOnly
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
                  : "border-border text-muted-foreground hover:border-sky-500/30 hover:text-foreground"
              )}
            >
              <Droplets className="w-2.5 h-2.5" />
              Blossom only
            </button>
            <button
              onClick={() => onChange({ ...filters, nip66Only: !filters.nip66Only })}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border font-medium transition-all flex items-center gap-1.5 w-fit",
                filters.nip66Only
                  ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30"
                  : "border-border text-muted-foreground hover:border-violet-500/30 hover:text-foreground"
              )}
            >
              <ShieldCheck className="w-2.5 h-2.5" />
              NIP-66 enriched
            </button>
          </div>
        </FilterSection>

        {/* Minimum uptime */}
        <FilterSection title="Minimum Uptime">
          <div className="px-1">
            <Slider
              value={[filters.minUptime]}
              min={0}
              max={99.5}
              step={0.5}
              onValueChange={([v]) => onChange({ ...filters, minUptime: v })}
              className="mb-3"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Any</span>
              <span className="font-semibold text-foreground">
                {filters.minUptime === 0 ? "Any" : `≥${filters.minUptime}%`}
              </span>
              <span>99.5%</span>
            </div>
            {/* Quick preset buttons */}
            <div className="flex gap-1 mt-2 flex-wrap">
              {[95, 97, 99, 99.5].map((v) => (
                <button
                  key={v}
                  onClick={() => onChange({ ...filters, minUptime: v })}
                  className={cn(
                    "text-xs px-2 py-1 rounded border transition-all",
                    filters.minUptime === v
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  {v}%+
                </button>
              ))}
            </div>
          </div>
        </FilterSection>

        {/* Use cases */}
        <FilterSection title="Use Cases">
          <div className="flex flex-wrap gap-1.5">
            {USE_CASE_OPTIONS.map((uc) => (
              <UseCaseBadge
                key={uc}
                tag={uc as UseCaseTag}
                size="sm"
                onClick={() => toggleUseCase(uc as UseCaseTag)}
                active={filters.useCases.includes(uc as UseCaseTag)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Community votes "Best for" filter */}
        <FilterSection title="Best For (Community)" defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {ALL_VOTE_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleCommunityTag(tag as VoteTag)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border font-medium transition-all",
                  filters.communityTags.includes(tag as VoteTag)
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Countries */}
        <FilterSection title="Location" defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => toggleCountry(c.code)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border font-medium transition-all",
                  filters.countryCodes.includes(c.code)
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </FilterSection>
      </div>
    </aside>
  );
}
