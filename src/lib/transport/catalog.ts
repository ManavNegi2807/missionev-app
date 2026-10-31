import raw from "@/data/vehicle-catalog.json";
import type { Confidence, Powertrain, VehicleBody } from "@/lib/carbon/types";

/**
 * Model look-up for the registration form. The shipped catalogue lists models only; it carries no efficiency figures
 * (see its `_readme`). Anything this module returns as an efficiency came from an `efficiency` block someone added with a
 * citation, and is always shown with that source and a confidence level.
 */
export interface CatalogEfficiency {
  mileageKmPerUnit?: number;
  usableBatteryKWh?: number;
  rangeKm?: number;
  kWhPer100Km?: number;
  source: string;
  sourceUrl?: string;
  year: string;
  confidence: Confidence;
}

export interface CatalogEntry {
  manufacturer: string;
  model: string;
  body: VehicleBody;
  powertrain: Powertrain;
  isSuv?: boolean;
  variants?: string[];
  efficiency?: CatalogEfficiency;
}

export const CATALOG: readonly CatalogEntry[] = (raw as { entries: CatalogEntry[] }).entries;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const manufacturersFor = (body: VehicleBody, powertrain: Powertrain, catalog: readonly CatalogEntry[] = CATALOG): string[] =>
  [...new Set(catalog.filter((e) => e.body === body && e.powertrain === powertrain).map((e) => e.manufacturer))].sort();

export const modelsFor = (body: VehicleBody, powertrain: Powertrain, manufacturer: string, catalog: readonly CatalogEntry[] = CATALOG): string[] =>
  [...new Set(catalog.filter((e) => e.body === body && e.powertrain === powertrain && norm(e.manufacturer) === norm(manufacturer)).map((e) => e.model))].sort();

/** Exact (normalised) match on manufacturer + model for the body/fuel; null when the model isn't catalogued. */
export function findEntry(args: { manufacturer: string; model: string; body: VehicleBody; powertrain: Powertrain }, catalog: readonly CatalogEntry[] = CATALOG): CatalogEntry | null {
  const m = norm(args.manufacturer);
  const mo = norm(args.model);
  if (!mo) return null;
  return catalog.find((e) => e.body === args.body && e.powertrain === args.powertrain && norm(e.model) === mo && (!m || norm(e.manufacturer) === m)) ?? null;
}

/** Loosely finds a catalogued model named anywhere in free text (used on OCR output). Longest model name wins. */
export function findModelInText(text: string, catalog: readonly CatalogEntry[] = CATALOG): CatalogEntry | null {
  const t = ` ${norm(text)} `;
  let best: CatalogEntry | null = null;
  for (const e of catalog) {
    const name = norm(e.model);
    if (name.length >= 3 && t.includes(` ${name} `) && (!best || name.length > norm(best.model).length)) best = e;
  }
  return best;
}
