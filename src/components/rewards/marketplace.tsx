"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import { CATALOG, GROUPS, type CatalogItem, type Group } from "@/lib/rewards/catalog";
import { useRewards } from "@/providers/rewards-provider";
import { RewardCard } from "./reward-card";

type Sort = "popularity" | "cost-asc" | "cost-desc";

export function Marketplace({ onRedeem }: { onRedeem: (item: CatalogItem) => void }) {
  const { summary, stockLeft } = useRewards();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group | "all">("all");
  const [sort, setSort] = useState<Sort>("popularity");

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = CATALOG.filter(
      (i) => (group === "all" || i.group === group) && (!needle || `${i.name} ${i.category} ${i.group} ${i.description}`.toLowerCase().includes(needle)),
    );
    return [...list].sort((a, b) => (sort === "cost-asc" ? a.cost - b.cost : sort === "cost-desc" ? b.cost - a.cost : b.popularity - a.popularity));
  }, [q, group, sort]);

  const topIds = useMemo(
    () => new Set([...CATALOG].sort((a, b) => b.popularity - a.popularity).slice(0, 2).map((i) => i.id)),
    [],
  );

  const chip = (active: boolean) =>
    cn(
      "h-9 shrink-0 rounded-full border px-3.5 font-mono text-[11px] tracking-[0.08em] whitespace-nowrap uppercase transition",
      active ? "border-lime/60 bg-lime/[0.1] text-lime" : "border-line bg-bg-2 text-muted hover:border-line-strong hover:text-fg",
    );

  return (
    <section aria-labelledby="market-title" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-label mb-1.5">Process 6.0 · Redemption marketplace</p>
          <h2 id="market-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Choose your next green benefit.
          </h2>
        </div>
        <Badge tone="warn" dot>
          Demo redemption catalog
        </Badge>
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-muted">
        Every item below is a sample. Costs are illustrative and none of them implies a commercial partnership or real voucher availability.
      </p>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative block flex-1">
            <span className="sr-only">Search rewards</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search rewards…"
              className="h-11 w-full rounded-lg border border-line bg-bg-2 pr-3 pl-9 text-sm text-fg placeholder:text-muted/60 hover:border-line-strong focus-visible:border-cyan/60 focus-visible:ring-2 focus-visible:ring-cyan/30 focus-visible:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 sm:w-64">
            <span className="section-label shrink-0">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-11 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg hover:border-line-strong focus-visible:border-cyan/60 focus-visible:ring-2 focus-visible:ring-cyan/30 focus-visible:outline-none"
            >
              <option value="popularity">Popularity (demo)</option>
              <option value="cost-asc">Cost: low to high</option>
              <option value="cost-desc">Cost: high to low</option>
            </select>
          </label>
        </div>

        <div role="group" aria-label="Filter by category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <button type="button" aria-pressed={group === "all"} className={chip(group === "all")} onClick={() => setGroup("all")}>
            All
          </button>
          {GROUPS.map((g) => (
            <button key={g} type="button" aria-pressed={group === g} className={chip(group === g)} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
        <p role="status" className="font-mono text-[11px] tracking-[0.1em] text-muted">
          SHOWING {items.length} OF {CATALOG.length} REWARDS
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
          <SearchX aria-hidden className="size-8 text-muted" />
          <p className="text-sm font-medium text-fg">No rewards match your search.</p>
          <p className="text-sm text-muted">Try a different keyword or clear the category filter.</p>
          <Button
            size="sm"
            onClick={() => {
              setQ("");
              setGroup("all");
            }}
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 min-[1760px]:grid-cols-4">
          {items.map((i) => (
            <RewardCard key={i.id} item={i} stockLeft={stockLeft(i)} balance={summary.balance} popular={topIds.has(i.id)} onRedeem={onRedeem} />
          ))}
        </ul>
      )}
    </section>
  );
}
