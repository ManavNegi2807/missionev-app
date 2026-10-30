import { formatNumber } from "@/lib/format";

/** CO₂e mass from grams → { value, unit } using kg, or tonnes from 1,000 kg. Matches Screen 03's decimal rule. */
export function formatMass(g: number): { value: string; unit: string } {
  const kg = g / 1000;
  if (kg >= 1000) return { value: formatNumber(kg / 1000, 2), unit: "t CO₂e" };
  return { value: kg < 10 ? formatNumber(kg, 3) : formatNumber(kg, 1), unit: "kg CO₂e" };
}
export const massText = (g: number) => {
  const m = formatMass(g);
  return `${m.value} ${m.unit}`;
};

export const formatKm = (km: number) => (km >= 1000 ? formatNumber(km, 0) : formatNumber(km, km < 10 ? 2 : 1));
export const pct = (x: number | null, dp = 1) => (x === null ? "—" : `${formatNumber(x * 100, dp)}%`);
export const signed = (n: number, dp = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatNumber(Math.abs(n), dp)}`;
