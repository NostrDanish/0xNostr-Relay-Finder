import { useState, useEffect, useMemo } from "react";
import { useSeoMeta } from "@unhead/react";
import { useSearchParams } from "react-router-dom";
import { Grid3X3, List, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { RelayCard } from "@/components/relay/RelayCard";
import { RelayFilters, type RelayFiltersState, DEFAULT_FILTERS } from "@/components/relay/RelayFilters";
import { useRelayData } from "@/hooks/useRelayData";
import { filterRelays } from "@/lib/utils";
import type { UseCaseTag } from "@/types/relay";

export function RelaysPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { relays, loading } = useRelayData();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const [filters, setFilters] = useState<RelayFiltersState>(() => ({
    ...DEFAULT_FILTERS,
    pricing: (searchParams.get("pricing") as RelayFiltersState["pricing"]) ?? "any",
    minUptime: Number(searchParams.get("minUptime") ?? 0),
    useCases: searchParams.get("useCase") ? [searchParams.get("useCase") as UseCaseTag] : [],
    sortBy: (searchParams.get("sortBy") as RelayFiltersState["sortBy"]) ?? "uptime",
    nip66Only: searchParams.get("nip66Only") === "true",
    blossomOnly: searchParams.get("blossomOnly") === "true",
  }));

  // Sync search param changes
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearch(q);
  }, [searchParams]);

  const filtered = useMemo(
    () =>
      filterRelays(relays, {
        search: search || undefined,
        pricing: filters.pricing,
        minUptime: filters.minUptime || undefined,
        countryCodes: filters.countryCodes.length ? filters.countryCodes : undefined,
        useCases: filters.useCases.length ? filters.useCases : undefined,
        communityTags: filters.communityTags.length ? filters.communityTags : undefined,
        onlineOnly: filters.onlineOnly,
        blossomOnly: filters.blossomOnly,
        nip66Only: filters.nip66Only,
        sortBy: filters.sortBy,
      }),
    [relays, search, filters]
  );

  useSeoMeta({
    title: "Relay Explorer — 0xNostrRelays",
    description: "Browse and filter all Nostr relays. Compare uptime, pricing, NIPs, and use cases to find the best relay for you.",
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      setSearchParams({ q: search.trim() });
    } else {
      setSearchParams({});
    }
  };

  const clearSearch = () => {
    setSearch("");
    setSearchParams({});
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black mb-1">
          Relay Explorer
        </h1>
        <p className="text-muted-foreground text-sm">
          Discover and compare Nostr relays. Find the perfect relay for your needs.
        </p>
      </div>

      {/* Search + Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search relays by name, URL, use case…"
            className="pl-9 pr-9 h-10"
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Sort */}
        <Select
          value={filters.sortBy}
          onValueChange={(v) => setFilters((f) => ({ ...f, sortBy: v as RelayFiltersState["sortBy"] }))}
        >
          <SelectTrigger className="w-auto h-10 gap-2 text-sm min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uptime">Sort: Uptime ↓</SelectItem>
            <SelectItem value="score">Sort: Trust Score ↓</SelectItem>
            <SelectItem value="votes">Sort: Most Voted</SelectItem>
            <SelectItem value="alpha">Sort: A → Z</SelectItem>
            <SelectItem value="newest">Sort: Newest</SelectItem>
            <SelectItem value="popular">Sort: Most Popular</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex border border-border rounded-lg overflow-hidden h-10">
          <button
            onClick={() => setView("grid")}
            className={`px-3 flex items-center transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Grid view"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 flex items-center transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile filter trigger */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden gap-2 h-10">
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>Filter Relays</SheetTitle>
            </SheetHeader>
            <RelayFilters
              filters={filters}
              onChange={setFilters}
              resultCount={filtered.length}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-6">
        {/* Sidebar filters (desktop) */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-24 bg-card/50 border border-border/50 rounded-xl p-4 backdrop-blur-sm">
            <RelayFilters
              filters={filters}
              onChange={setFilters}
              resultCount={filtered.length}
            />
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {/* Result count */}
          {!loading && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Found <strong className="text-foreground">{filtered.length}</strong> relays
                {search && <> matching "<strong className="text-foreground">{search}</strong>"</>}
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className={`grid gap-4 ${view === "grid" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border border-border/60 rounded-xl p-4 space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-lg mb-2">No relays found</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Try adjusting your search or filters. Clear filters to see all relays.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearch("");
                  setFilters(DEFAULT_FILTERS);
                  setSearchParams({});
                }}
              >
                Clear all filters
              </Button>
            </div>
          )}

          {/* Relay grid/list */}
          {!loading && filtered.length > 0 && (
            <div
              className={
                view === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                  : "flex flex-col gap-2"
              }
            >
              {filtered.map((relay) => (
                <RelayCard key={relay.id} relay={relay} view={view} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
