import type { Confidence, Powertrain, VehicleBody } from "@/lib/carbon/types";
import { findModelInText, type CatalogEntry } from "@/lib/transport/catalog";

/**
 * Turns the text lines Azure AI Vision's Read OCR returns for a ride receipt into structured, REVIEWABLE fields.
 *
 * OCR is text extraction, not proof: nothing here shows the ride happened, or what fuel the car uses, and receipts differ
 * by provider, app version and language. Every field is a suggestion with a confidence level; the commuter reviews and
 * corrects them before anything is used. Driver names, plate numbers and phone numbers are deliberately never read out.
 */
export type RideProvider = "ola" | "uber" | "rapido";
export const PROVIDER_LABEL: Record<RideProvider, string> = { ola: "Ola", uber: "Uber", rapido: "Rapido" };

export interface ReceiptExtraction {
  provider: RideProvider | null;
  distanceKm: number | null;
  distanceRaw: string | null;
  /** ISO date (yyyy-mm-dd) when one could be read. */
  tripDate: string | null;
  vehicleText: string | null;
  model: { manufacturer: string; model: string; body: VehicleBody; powertrain: Powertrain; isSuv?: boolean } | null;
  /** The ride class printed on the receipt, e.g. "Prime Sedan". */
  serviceClass: string | null;
  bodyHint: "car" | "two_wheeler" | "three_wheeler" | null;
  /** Shown for review only; never stored. */
  pickup: string | null;
  drop: string | null;
  confidence: { provider: Confidence; distance: Confidence; date: Confidence; vehicle: Confidence };
  notes: string[];
}

const PROVIDER_PATTERNS: Array<[RideProvider, RegExp]> = [
  ["rapido", /\brapido\b|\broppen\b/gi],
  ["uber", /\buber\b|\bubergo\b|\buberxl\b/gi],
  ["ola", /\bola\b|\bani technologies\b|\bola cabs\b/gi],
];

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const iso = (y: number, m: number, d: number) => (y >= 2015 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null);

function readDate(text: string): string | null {
  let m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*[,.]?\s+(20\d{2})\b/);
  if (m && MONTHS[m[2].toLowerCase()]) return iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  m = text.match(/\b([A-Za-z]{3})[a-z]*\s+(\d{1,2})[,.]?\s+(20\d{2})\b/);
  if (m && MONTHS[m[1].toLowerCase()]) return iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/); // India: day first
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

const toNumber = (s: string) => Number(s.replace(",", "."));

function readDistance(text: string): { km: number | null; raw: string | null; confidence: Confidence; note?: string } {
  const labelled = text.match(/(?:trip|ride|total)?\s*distance\s*[:\-–]?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:km|kms|kilomet\w*)?/i);
  const plain = [...text.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:km|kms|kilomet\w*)\b/gi)];
  const ok = (n: number) => Number.isFinite(n) && n >= 0.1 && n <= 500;
  if (labelled && ok(toNumber(labelled[1]))) return { km: toNumber(labelled[1]), raw: labelled[0].trim(), confidence: "high" };
  const values = [...new Set(plain.map((p) => toNumber(p[1])).filter(ok))];
  if (values.length === 1) return { km: values[0], raw: plain[0][0].trim(), confidence: "medium" };
  if (values.length > 1) return { km: values[0], raw: plain[0][0].trim(), confidence: "low", note: `Several distances were found (${values.join(", ")} km); check this one.` };
  return { km: null, raw: null, confidence: "low" };
}

const CLASS_RE = /\b(prime sedan|prime suv|prime play|prime|mini|micro|ubergo|uber go|premier|uberxl|uber xl|cab economy|cab premium|economy|auto|bike|moto)\b/i;

function readClass(text: string): { serviceClass: string | null; bodyHint: ReceiptExtraction["bodyHint"] } {
  const m = text.match(CLASS_RE);
  if (!m) return { serviceClass: null, bodyHint: null };
  const c = m[1].toLowerCase();
  const bodyHint = c === "bike" || c === "moto" ? "two_wheeler" : c === "auto" ? "three_wheeler" : "car";
  return { serviceClass: m[1].replace(/\b\w/g, (x) => x.toUpperCase()), bodyHint };
}

const clip = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 60);

function readPlace(lines: string[], keys: RegExp): string | null {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(keys);
    if (!m) continue;
    const same = lines[i].slice((m.index ?? 0) + m[0].length).replace(/^[\s:\-–]+/, "");
    const label = same || lines[i + 1] || "";
    if (label && !CLASS_RE.test(label) && label.length > 2) return clip(label);
  }
  return null;
}

export function parseReceipt(lines: string[], catalog?: readonly CatalogEntry[]): ReceiptExtraction {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  const text = clean.join("\n");
  const notes: string[] = [];

  const scores = PROVIDER_PATTERNS.map(([p, re]) => [p, (text.match(re) ?? []).length] as const).sort((a, b) => b[1] - a[1]);
  const provider = scores[0][1] > 0 ? scores[0][0] : null;
  const providerConfidence: Confidence = provider ? (scores[1][1] > 0 ? "low" : "high") : "low";
  if (!provider) notes.push("No ride provider name was recognised on the receipt.");

  const dist = readDistance(text);
  if (dist.note) notes.push(dist.note);
  if (dist.km === null) notes.push("No trip distance was found; enter it from the receipt.");

  const date = readDate(text);
  const cls = readClass(text);
  if (cls.bodyHint === "three_wheeler") notes.push("Auto-rickshaws aren't supported yet, so this journey can be calculated off-chain only after you pick a supported vehicle.");

  const entry = findModelInText(text, catalog);
  const vehicleLine = clean.find((l) => /(vehicle|car|cab|model|ride)\s*[:\-–]/i.test(l) && l.length < 80) ?? null;
  const model = entry ? { manufacturer: entry.manufacturer, model: entry.model, body: entry.body, powertrain: entry.powertrain, isSuv: entry.isSuv } : null;
  const vehicleConfidence: Confidence = entry ? "medium" : "low";
  if (!entry) notes.push("The car model wasn't recognised from the receipt text; choose it manually.");
  else notes.push(`“${entry.manufacturer} ${entry.model}” matched the model list. The list can't tell you the fuel of the actual car, so confirm it.`);

  return {
    provider,
    distanceKm: dist.km,
    distanceRaw: dist.raw,
    tripDate: date,
    vehicleText: vehicleLine ? clip(vehicleLine.replace(/.*?[:\-–]\s*/, "")) : null,
    model,
    serviceClass: cls.serviceClass,
    bodyHint: cls.bodyHint,
    pickup: readPlace(clean, /^(pick[\s-]?up|from)\b/i),
    drop: readPlace(clean, /^(drop[\s-]?(?:off)?|destination|to)\b/i),
    confidence: { provider: providerConfidence, distance: dist.confidence, date: date ? "medium" : "low", vehicle: vehicleConfidence },
    notes,
  };
}
