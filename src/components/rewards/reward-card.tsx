"use client";

import { Badge, Button } from "@/components/ui/primitives";
import { cn, formatNumber } from "@/lib/format";
import { availability, type CatalogItem } from "@/lib/rewards/catalog";
import { RewardIcon } from "./reward-icons";

export function RewardCard({
  item,
  stockLeft,
  balance,
  popular,
  onRedeem,
}: {
  item: CatalogItem;
  stockLeft: number;
  balance: number;
  popular: boolean;
  onRedeem: (item: CatalogItem) => void;
}) {
  const av = availability(stockLeft);
  const short = Math.max(0, item.cost - balance);
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-panel transition hover:border-line-strong" data-reward={item.id}>
      <div className="relative flex h-24 items-center justify-between overflow-hidden border-b border-line bg-gradient-to-br from-lime/[0.08] via-transparent to-cyan/[0.08] px-4">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: "linear-gradient(to right, var(--color-line) 1px, transparent 1px), linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
        />
        <span className="relative grid size-12 place-items-center rounded-xl border border-lime/30 bg-bg-2/80 text-lime">
          <RewardIcon kind={item.icon} />
        </span>
        <div className="relative flex flex-col items-end gap-1.5">
          <Badge tone="warn">Demo</Badge>
          {popular && <Badge tone="cyan">Popular</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="section-label">{item.category}</p>
          <h3 className="mt-1 text-[15px] font-semibold text-fg">{item.name}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.description}</p>
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-end justify-between gap-3">
            <p className="font-mono text-2xl leading-none font-semibold text-lime">
              {formatNumber(item.cost)} <span className="text-xs font-normal text-muted">$MEV</span>
            </p>
            <p
              className={cn(
                "text-right text-[11px] leading-tight",
                av.kind === "available" && "text-ok",
                av.kind === "limited" && "text-warn",
                av.kind === "unavailable" && "text-err",
              )}
            >
              {av.label}
            </p>
          </div>
          <Button
            variant={short === 0 && av.kind !== "unavailable" ? "primary" : "secondary"}
            className="w-full"
            disabled={av.kind === "unavailable"}
            aria-label={`Redeem ${item.name} for ${item.cost} $MEV`}
            onClick={() => onRedeem(item)}
          >
            {av.kind === "unavailable" ? "Unavailable" : "Redeem"}
          </Button>
          {av.kind !== "unavailable" && short > 0 && <p className="text-center text-[11px] text-muted">Need {formatNumber(short)} more $MEV</p>}
        </div>
      </div>
    </li>
  );
}
