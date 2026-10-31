import type { AccountingBoundaryId, EmissionFactor, Powertrain, VehicleBody } from "./types";

/**
 * Central emission-factor configuration. Every number the app multiplies by lives here, with its source, year, unit,
 * geography and how much to trust it. Nothing is hard-coded in components or in the engine.
 *
 * `status`: "primary" = read from the publisher's own file; "secondary" = quoted by a reputable secondary source and
 * not re-checked against the original; "assumption" = a MissionEV placeholder with no source. Assumptions are the first
 * thing to replace before any external claim is made.
 */

export const BOUNDARY: Record<AccountingBoundaryId, { label: string; description: string }> = {
  "energy-use-direct": {
    label: "Vehicle energy use (direct emissions)",
    description:
      "CO2 released where the energy is converted: fuel burnt in the vehicle for petrol, diesel and CNG; fuel burnt at the power station for grid electricity. " +
      "Excludes fuel and electricity supply chains (well-to-tank), grid transmission & distribution losses, and vehicle or battery manufacturing.",
  },
};

export const BOUNDARY_ID: AccountingBoundaryId = "energy-use-direct";

/* ------------------------------------------------------------------ electricity */

/**
 * CEA "CO2 Baseline Database for the Indian Power Sector", Version 22.0 (workbook dated 2026-08-01), sheet "Results".
 * Row "Weighted Average Grid Emission Rate (Incl. RES, Captive) (2)": all-India average CO2 per unit of net electricity
 * generated, including renewables and grid-connected captive injection, adjusted for imports. Values below are copied
 * from the workbook (tCO2/MWh, numerically equal to kgCO2/kWh).
 *
 * Why this series and not the CDM margins: the operating, build and combined margins in the same workbook are
 * marginal-plant factors built for CDM project baselines ("what does extra supply displace?"). They are not average
 * emission rates of electricity consumed, so they are NOT used for ordinary charging accounting. The user guide says
 * the weighted average "describes the average CO2 emitted per unit of electricity generated in the grid".
 *
 * Geography is national: the database has no Delhi-specific factor.
 */
export const CEA_GRID = {
  version: "22.0",
  published: "2026-08-01",
  sourceUrl: "https://cea.nic.in/cdm-co2-baseline-view?lang=en&mappingId=234",
  series: "Weighted Average Grid Emission Rate (Incl. RES, Captive), adjusted for imports",
  /** FY start year → tCO2/MWh. */
  inclImports: {
    2016: 0.7656118415885905,
    2017: 0.7500422626475309,
    2018: 0.7411039744082348,
    2019: 0.708705383432227,
    2020: 0.6975385713186759,
    2021: 0.7113500285903359,
    2022: 0.7160031593941543,
    2023: 0.7271599041096539,
    2024: 0.7101023036210137,
    2025: 0.6750986831448641,
  } as Record<number, number>,
  /** Same series before the import adjustment; kept for reference and sensitivity checks. */
  exclImports: {
    2016: 0.7693209113512789,
    2017: 0.7534814241273895,
    2018: 0.7437754812199783,
    2019: 0.7121422698946844,
    2020: 0.7025585998172622,
    2021: 0.7152071837943554,
    2022: 0.7191309375035912,
    2023: 0.7288615409681269,
    2024: 0.7121402774099946,
    2025: 0.6780328931474631,
  } as Record<number, number>,
} as const;

/** Indian financial year (April–March) a timestamp falls in, as its start year. */
export const financialYearStart = (at: number | Date): number => {
  const d = new Date(at);
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
};
const fyLabel = (start: number) => `${start}-${String(start + 1).slice(2)}`;

export interface GridFactorChoice {
  factor: EmissionFactor;
  /** True when the trip's year isn't published yet, so the latest published year was used. */
  fellBack: boolean;
}

/** The location-based national grid factor for the trip's financial year (latest published year if it isn't out yet). */
export function gridFactorFor(at: number | Date): GridFactorChoice {
  const years = Object.keys(CEA_GRID.inclImports).map(Number);
  const latest = Math.max(...years);
  const wanted = financialYearStart(at);
  const start = wanted > latest ? latest : Math.max(wanted, Math.min(...years));
  const fellBack = start !== wanted;
  return {
    fellBack,
    factor: {
      id: `grid.in.cea-v${CEA_GRID.version}.fy${start}`,
      label: "India grid electricity, weighted-average emission rate",
      value: CEA_GRID.inclImports[start],
      unit: "kgCO2/kWh",
      boundary: BOUNDARY_ID,
      geography: "India (national average)",
      year: `FY ${fyLabel(start)}`,
      version: `CEA CO2 Baseline Database v${CEA_GRID.version}`,
      method: "Location-based average: absolute CO2 of all grid-connected stations ÷ net generation (incl. renewables and captive injection, adjusted for imports)",
      source: "Central Electricity Authority, Government of India",
      sourceUrl: CEA_GRID.sourceUrl,
      status: "primary",
      confidence: "high",
      notes: fellBack
        ? `FY ${fyLabel(wanted)} is not published yet; the latest published year (FY ${fyLabel(start)}) is used.`
        : "National average. No state- or city-level factor is published in this database.",
    },
  };
}

/* ------------------------------------------------------------------ fuels */

/**
 * Tank-to-wheel (combustion) emissions per litre. Values as published by Smart Freight Centre's "India Default GHG
 * Emission Values" (2025), which derive them from the IPCC 2006 default CO2 factors (petrol 69,300 kg/TJ, diesel
 * 74,100 kg/TJ) and net calorific values. The values reached this build through a search summary that cited Climatiq; the
 * original PDF refused a direct download, so status is "secondary". Combustion only: no well-to-tank emissions, to match the boundary.
 */
const SFC_URL = "https://smart-freight-centre-media.s3.amazonaws.com/documents/India_Default_GHG_Emission_Values_SFC_INDIA_v1_2.pdf";

export const FUEL_FACTORS: Record<"petrol" | "diesel" | "cng", EmissionFactor> = {
  petrol: {
    id: "fuel.petrol.ttw.in.sfc2025",
    label: "Petrol, combustion",
    value: 2.232,
    unit: "kgCO2e/L",
    boundary: BOUNDARY_ID,
    geography: "India",
    year: "2025",
    version: "SFC India Default GHG Emission Values v1.2",
    method: "Tank-to-wheel; IPCC 2006 default CO2 factor × net calorific value × density",
    source: "Smart Freight Centre (India defaults, May 2025), via Climatiq",
    sourceUrl: SFC_URL,
    status: "secondary",
    confidence: "medium",
    notes: "Other published figures for petrol range up to about 2.31 kgCO2e/L; verify against the SFC PDF or the GHG Platform India before external reporting.",
  },
  diesel: {
    id: "fuel.diesel.ttw.in.sfc2025",
    label: "Diesel, combustion",
    value: 2.675,
    unit: "kgCO2e/L",
    boundary: BOUNDARY_ID,
    geography: "India",
    year: "2025",
    version: "SFC India Default GHG Emission Values v1.2",
    method: "Tank-to-wheel; IPCC 2006 default CO2 factor × net calorific value × density",
    source: "Smart Freight Centre (India defaults, May 2025), via Climatiq",
    sourceUrl: SFC_URL,
    status: "secondary",
    confidence: "medium",
  },
  cng: {
    id: "fuel.cng.ttw.ipcc2006",
    label: "CNG, combustion",
    value: 2.693,
    unit: "kgCO2/kg",
    boundary: BOUNDARY_ID,
    geography: "Global default",
    year: "2006",
    version: "IPCC 2006 Guidelines, Vol. 2 Ch. 1",
    method: "Natural-gas default CO2 factor 56,100 kg/TJ × default net calorific value 48.0 TJ/Gg",
    source: "IPCC 2006 default values (computed here)",
    status: "assumption",
    confidence: "low",
    notes: "Computed from remembered IPCC defaults and not re-checked in this build. CNG is only reachable through a ride-hail confirmation and is never rewarded.",
  },
};

/* ------------------------------------------------------------------ public transport */

/**
 * Metro, derived from a TERI table for Delhi: traction electricity 699,000 MWh over 16.998 billion passenger-km
 * ≈ 0.041 kWh per passenger-km. That table could not be opened in this build (the figures reached it second-hand through
 * a search summary), and it covers traction only. Treat as a placeholder until DMRC's own annual-report figures replace it.
 */
export const METRO_ENERGY = {
  kWhPerPassengerKm: 0.041,
  status: "assumption" as const,
  confidence: "low" as const,
  source: "Derived from a TERI Delhi per-passenger emissions table (traction 699,000 MWh ÷ 16.998 bn passenger-km); not independently verified",
  sourceUrl: "https://teriin.org/sites/default/transport/Per_passenger_emission_in_Delhi_Different_Modes.pdf",
};

/**
 * Electric bus: energy per km from an IEA-hosted Kolkata e-bus case study (12 m bus, 1.06 km/kWh, read second-hand), and an
 * average-load assumption with NO source. Passenger-km emissions = energy per km ÷ average passengers × grid factor.
 */
export const EBUS_ENERGY = {
  kWhPerVehicleKm: 1 / 1.06,
  averagePassengers: 25,
  status: "assumption" as const,
  confidence: "low" as const,
  source: "Energy: Kolkata e-bus case study (1.06 km/kWh, 12 m bus). Average passengers: MissionEV assumption, unsourced",
  sourceUrl: "https://iea.blob.core.windows.net/assets/db408b53-276c-47d6-8b05-52e53b1208e1/e-bus-case-study-Kolkata-Clarifications.pdf",
};

/** Walking and cycling emit nothing at the point of energy use; food-energy emissions are outside the boundary. */
export const ACTIVE_TRAVEL = { gramsPerKm: 0 };

/* ------------------------------------------------------------------ reference (baseline) scenarios */

/**
 * The comparison scenario for "emissions avoided". These are MissionEV prototype assumptions, not fleet statistics:
 * replace them with a BEE / ARAI / ICCT in-use fleet average before publishing numbers. They were carried over from the
 * earlier prototype so results stay continuous.
 */
export const REFERENCE_VEHICLES: Record<VehicleBody, { label: string; powertrain: Powertrain; kmPerLitre: number }> = {
  car: { label: "average petrol car", powertrain: "petrol", kmPerLitre: 18 },
  two_wheeler: { label: "average petrol two-wheeler", powertrain: "petrol", kmPerLitre: 50 },
};

/** Reference EV efficiency for the "your EV vs a comparable EV" panel (kWh per km, battery side). Prototype assumptions. */
export const REFERENCE_EV: Record<VehicleBody, { label: string; kWhPerKm: number }> = {
  car: { label: "reference electric car (compact SUV class)", kWhPerKm: 0.14 },
  two_wheeler: { label: "reference electric scooter", kWhPerKm: 0.03 },
};

/** Share of the grid electricity that reaches the battery. Applied only when an EV's consumption is battery-side. Unsourced. */
export const CHARGING_EFFICIENCY = 0.9;

/**
 * Last-resort efficiencies, used only when the commuter can't give a figure and no catalogue entry exists.
 * Always shown as "category default", never as the vehicle's own number.
 */
export const CATEGORY_DEFAULTS = {
  petrol: { car: 18, two_wheeler: 45 }, // km/l
  diesel: { car: 15, two_wheeler: 45 }, // km/l
  cng: { car: 22, two_wheeler: 22 }, // km/kg
  electric: { car: 0.14, two_wheeler: 0.03 }, // kWh/km, battery side
} as const;

/** Sanity bounds so a typo can't create a nonsense credit. */
export const EFFICIENCY_BOUNDS = {
  mileageKmPerLitre: { car: [5, 40], two_wheeler: [20, 110] },
  mileageKmPerKg: { car: [8, 45], two_wheeler: [20, 90] },
  kWhPerKm: { car: [0.08, 0.35], two_wheeler: [0.015, 0.09] },
  usableBatteryKWh: { car: [5, 150], two_wheeler: [0.8, 12] },
  rangeKm: { car: [60, 900], two_wheeler: [30, 300] },
} as const;

/** Largest value the contract's uint32 fields can hold. */
export const UINT32_MAX = 4_294_967_295;
