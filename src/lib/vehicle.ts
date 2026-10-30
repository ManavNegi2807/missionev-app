export const VEHICLE_CATEGORIES = [
  "Two-wheeler",
  "Four-wheeler",
  "Electric two-wheeler",
  "Electric car",
  "Commercial",
] as const;

export const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"] as const;

export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];
export type FuelType = (typeof FUEL_TYPES)[number];

export interface VehicleForm {
  regNumber: string;
  category: VehicleCategory | "";
  fuel: FuelType | "";
  manufacturer: string;
  model: string;
  year: string;
}

export type VehicleErrors = Partial<Record<keyof VehicleForm, string>>;

export const EMPTY_VEHICLE_FORM: VehicleForm = {
  regNumber: "",
  category: "",
  fuel: "",
  manufacturer: "",
  model: "",
  year: "",
};

/** Validated form, safe to hand to a registry adapter. */
export interface VehicleInput {
  regNumber: string; // normalized, e.g. DL01AB1234
  category: VehicleCategory;
  fuel: FuelType;
  manufacturer: string;
  model: string;
  year: number;
}

const STATE_CODES = new Set(
  (
    "AN AP AR AS BR CH CG DD DL DN GA GJ HR HP JK JH KA KL LA LD MP MH MN ML MZ NL OD OR PY PB RJ SK TN TS TG TR UP UK WB"
  ).split(" "),
);

const STANDARD = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/;
const BHARAT = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/;

export const normalizeReg = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Pretty-print a normalized registration number, e.g. DL01AB1234 -> "DL 01 AB 1234". */
export function formatReg(normalized: string): string {
  const std = STANDARD.exec(normalized);
  if (std) return `${std[1]} ${std[2].padStart(2, "0")} ${std[3]} ${std[4]}`;
  const bh = BHARAT.exec(normalized);
  if (bh) return `${bh[1]} ${bh[2]} ${bh[3]} ${bh[4]}`;
  return normalized;
}

/** Mask the series letters so the full identifier is never displayed/stored, e.g. "DL 01 ** 1234". */
export function maskReg(normalized: string): string {
  const std = STANDARD.exec(normalized);
  if (std) return `${std[1]} ${std[2].padStart(2, "0")} ${"*".repeat(std[3].length)} ${std[4]}`;
  const bh = BHARAT.exec(normalized);
  if (bh) return `${bh[1]} BH ${bh[3]} ${"*".repeat(bh[4].length)}`;
  return normalized.replace(/.(?=.{4})/g, "*");
}

export function validateReg(raw: string): string | undefined {
  const n = normalizeReg(raw);
  if (!n) return "Enter your vehicle registration number.";
  const bh = BHARAT.exec(n);
  if (bh) return undefined;
  const std = STANDARD.exec(n);
  if (!std) return "Use the format DL 01 AB 1234 (state, district, series, number).";
  if (!STATE_CODES.has(std[1])) return `"${std[1]}" is not a recognised state / UT code.`;
  return undefined;
}

export const MAX_YEAR = new Date().getFullYear();
export const MIN_YEAR = 1995;
export const PURCHASE_YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => String(MAX_YEAR - i));

export function validateVehicle(f: VehicleForm): VehicleErrors {
  const e: VehicleErrors = {};
  const regErr = validateReg(f.regNumber);
  if (regErr) e.regNumber = regErr;
  if (!f.category) e.category = "Select a vehicle category.";
  if (!f.fuel) e.fuel = "Select a fuel / power type.";
  if (f.category.startsWith("Electric") && f.fuel && f.fuel !== "Electric") {
    e.fuel = `${f.category} must use the Electric power type.`;
  } else if (f.fuel === "Electric" && (f.category === "Two-wheeler" || f.category === "Four-wheeler")) {
    e.category = "Electric power type needs an electric category (or Commercial).";
  }
  if (f.manufacturer.trim().length < 2) e.manufacturer = "Enter the manufacturer.";
  if (f.model.trim().length < 1) e.model = "Enter the model.";
  const y = Number(f.year);
  if (!f.year) e.year = "Select an approximate purchase year.";
  else if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) e.year = `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`;
  return e;
}

export function toVehicleInput(f: VehicleForm): VehicleInput {
  return {
    regNumber: normalizeReg(f.regNumber),
    category: f.category as VehicleCategory,
    fuel: f.fuel as FuelType,
    manufacturer: f.manufacturer.trim(),
    model: f.model.trim(),
    year: Number(f.year),
  };
}

export const MANUFACTURER_SUGGESTIONS: Record<VehicleCategory, string[]> = {
  "Two-wheeler": ["Honda", "Hero MotoCorp", "TVS", "Bajaj", "Royal Enfield", "Yamaha"],
  "Four-wheeler": ["Maruti Suzuki", "Hyundai", "Tata", "Mahindra", "Honda", "Toyota", "Kia"],
  "Electric two-wheeler": ["Ather", "Ola Electric", "TVS", "Bajaj", "Revolt", "Hero Electric"],
  "Electric car": ["Tata", "MG", "Mahindra", "Hyundai", "BYD", "Kia"],
  Commercial: ["Tata", "Ashok Leyland", "Mahindra", "Eicher", "Force Motors"],
};
