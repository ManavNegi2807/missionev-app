export const GROUPS = ["EV charging", "Public transport", "Metro passes", "Bike sharing", "Sustainable mobility", "Eco-partner vouchers"] as const;
export type Group = (typeof GROUPS)[number];
export type IconKey = "metro" | "charge" | "bike" | "leaf" | "transit" | "wrench";

export interface CatalogItem {
  id: string;
  name: string;
  /** Label shown on the card. */
  category: string;
  /** Filter group. */
  group: Group;
  description: string;
  /** Illustrative $MEV cost. */
  cost: number;
  /** Demo stock before this session's redemptions. */
  stock: number;
  /** Demo popularity score, used only for sorting. */
  popularity: number;
  icon: IconKey;
}

/**
 * DEMO REDEMPTION CATALOG. Costs are illustrative (the project docs list e.g. 50 / 100 / 200 as examples
 * "to be set with partners"). No item implies a commercial partnership or real voucher availability.
 */
export const CATALOG: CatalogItem[] = [
  { id: "metro-voucher", name: "Metro Travel Voucher", category: "Public Transport", group: "Metro passes", description: "A simulated metro travel voucher.", cost: 50, stock: 24, popularity: 95, icon: "metro" },
  { id: "ev-charging", name: "EV Charging Discount", category: "EV Charging", group: "EV charging", description: "A demo EV charging reward.", cost: 100, stock: 18, popularity: 88, icon: "charge" },
  { id: "bike-pass", name: "Bike Sharing Pass", category: "Micro Mobility", group: "Bike sharing", description: "A demo bicycle-sharing benefit.", cost: 40, stock: 40, popularity: 70, icon: "bike" },
  { id: "green-voucher", name: "Green Mobility Voucher", category: "Sustainable Mobility", group: "Sustainable mobility", description: "A simulated partner reward.", cost: 200, stock: 9, popularity: 60, icon: "leaf" },
  { id: "transit-pass", name: "Public Transit Pass", category: "Transport", group: "Public transport", description: "A simulated public-transit pass.", cost: 120, stock: 3, popularity: 82, icon: "transit" },
  { id: "ev-maintenance", name: "EV Maintenance Benefit", category: "EV Services", group: "Eco-partner vouchers", description: "A simulated EV service benefit.", cost: 150, stock: 0, popularity: 45, icon: "wrench" },
];

export const getItem = (id: string) => CATALOG.find((c) => c.id === id);

export type Availability = { kind: "available" | "limited" | "unavailable"; label: string };
export function availability(stockLeft: number): Availability {
  if (stockLeft <= 0) return { kind: "unavailable", label: "Unavailable (demo stock)" };
  if (stockLeft <= 5) return { kind: "limited", label: `Limited · ${stockLeft} left (demo)` };
  return { kind: "available", label: `Available · ${stockLeft} in demo stock` };
}
