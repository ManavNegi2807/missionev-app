import { fnv1a } from "./format";
import { maskReg, type FuelType, type VehicleCategory, type VehicleInput } from "./vehicle";

/**
 * Vehicle-registry adapter boundary.
 *
 * The prototype ships ONLY the mock adapter below. It runs entirely in the
 * browser: nothing about the vehicle is sent to any server. A real Vahan /
 * partner integration would implement `VehicleRegistryAdapter` and be
 * selected in `getRegistryAdapter()` once credentials/endpoint are configured.
 */
export type RegistryFailureCode = "NOT_FOUND" | "REGISTRY_UNAVAILABLE" | "RC_INACTIVE";

export interface RegistryRecord {
  maskedReg: string;
  category: VehicleCategory;
  fuel: FuelType;
  manufacturer: string;
  model: string;
  year: number;
  rcStatus: "ACTIVE";
  /** Epoch ms the lookup was produced. For the mock this is generated locally. */
  verifiedAt: number;
  /** True when verifiedAt / record were generated locally rather than returned by a registry. */
  verifiedAtIsDemo: boolean;
  referenceId: string;
  source: "DEMO_REGISTRY";
}

export type RegistryResult =
  | { ok: true; record: RegistryRecord }
  | { ok: false; code: RegistryFailureCode; message: string };

export interface VehicleRegistryAdapter {
  id: string;
  label: string;
  isDemo: boolean;
  lookup(input: VehicleInput, signal?: AbortSignal): Promise<RegistryResult>;
}

/** Deterministic demo rules, keyed on the last four characters of the registration number. */
export const DEMO_RULES: ReadonlyArray<{ suffix: string; outcome: string }> = [
  { suffix: "0000", outcome: "Not found in registry" },
  { suffix: "7777", outcome: "RC inactive / suspended" },
  { suffix: "9999", outcome: "Registry unavailable (retry)" },
];

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

export const mockVahanAdapter: VehicleRegistryAdapter = {
  id: "mock-vahan",
  label: "DEMO REGISTRY",
  isDemo: true,
  async lookup(input, signal) {
    const h = fnv1a(input.regNumber);
    await wait(900 + (h % 700), signal);

    const tail = input.regNumber.slice(-4);
    if (tail === "0000") {
      return { ok: false, code: "NOT_FOUND", message: "No record matches this registration number in the demo registry." };
    }
    if (tail === "9999") {
      return { ok: false, code: "REGISTRY_UNAVAILABLE", message: "The demo registry simulated a timeout. Try again." };
    }
    if (tail === "7777") {
      return { ok: false, code: "RC_INACTIVE", message: "Registration certificate is inactive in the demo registry." };
    }

    return {
      ok: true,
      record: {
        maskedReg: maskReg(input.regNumber),
        category: input.category,
        fuel: input.fuel,
        manufacturer: input.manufacturer,
        model: input.model,
        year: input.year,
        rcStatus: "ACTIVE",
        verifiedAt: Date.now(),
        verifiedAtIsDemo: true,
        referenceId: `DEMO-${h.toString(16).toUpperCase().padStart(8, "0")}`,
        source: "DEMO_REGISTRY",
      },
    };
  },
};

export function getRegistryAdapter(): VehicleRegistryAdapter {
  return mockVahanAdapter;
}
