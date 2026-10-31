# MissionEV

*A Strava for carbon.* MissionEV measures the emissions of the journeys people actually make, compares each with a stated
reference journey, and turns lower-emission travel into **$MEV** rewards through an oracle-signed, wallet-submitted contract call.
Built for Build with Bharat 5.0 (Microsoft Azure) and Portaldot Hacker House 2026 (Portal Layer 0 EVM).

> **Reward the impact of the journey, not the ownership of the vehicle.** Each trip asks how you travelled; saved vehicles are only
> a profile. An EV owner in a petrol cab earns nothing for that ride; a metro commuter with no vehicle can earn.

Four screens: **01 Sign-in & transport profile → 02 Capture trip → 03 Rewards → 04 ESG analytics.**

```bash
npm install
npm run dev            # http://localhost:3000   (DEMO until the server is configured)
npm test               # 104 tests, incl. the compiled contract run in an in-process EVM
npm run build && npm run start
npm run contract:compile   # rebuild contracts/artifacts + src/lib/contract/missionev.abi.ts
npm run dev:chain          # LOCAL in-memory chain + the real contract, to try the LIVE flow
```

Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind v4, viem, recharts. Read `AGENTS.md` and `node_modules/next/dist/docs/`
before changing framework-level code. Light and dark theme (top bar).

**Read first:** [docs/INTEGRATION_REPORT.md](docs/INTEGRATION_REPORT.md) (what is real, what is simulated, what was tested, limitations)
and [docs/CONTRACT_AUDIT.md](docs/CONTRACT_AUDIT.md) (security findings in `MissionEV.sol`, proposed v2).

## DEMO and LIVE

The app is **DEMO** (everything labelled, nothing on-chain) until the server has `MISSIONEV_CONTRACT_ADDRESS`, `PORTAL_RPC_URL` and
`ORACLE_PRIVATE_KEY`. A journey is **LIVE** only if it was captured with real GPS, the server is configured, and a real wallet is
connected on Portal V3 (chain 420420777). Simulated trips are never signed. A DEMO result is never presented as an on-chain
transaction. `GET /api/status` shows what is configured (never the secrets).

## How a journey becomes $MEV

1. Capture the trip (real GPS, or a labelled simulation) and choose **how you travelled** for it.
2. Local checks run in the browser; the oracle re-runs them on the evidence it receives.
3. `src/lib/carbon` calculates actual emissions, a reference journey over the same distance on the **same accounting boundary**,
   and `co2AvoidedGrams = max(0, floor(reference − actual))`.
4. Your wallet signs a free proof message; `POST /api/oracle/sign-trip` re-verifies, **recalculates itself**, reads your nonce from the
   chain and signs the exact EIP-712 `TripPayload` (key server-side only).
5. Your wallet sends `recordCommute(tripId, mode, distanceMeters, co2AvoidedGrams, deadline, sig)` — the contract credits `msg.sender`, so
   the oracle can sign a trip but never submit it.
6. The app waits for the receipt and reads back the minted amount (from `Transfer` logs), `balanceOf` and `getCommuter`.

Reward (contract): `20 MEV per kg avoided × streak multiplier (1×/1.5×/2×/3×) + mode bonus`; $MEV is a prototype reward token, **not** a
certified carbon credit, and is a different thing from the native tPOT gas balance.

## Carbon accounting (`src/lib/carbon`)

One engine, one boundary: **direct energy-use emissions** — fuel burnt in the vehicle (petrol/diesel/CNG) and fuel burnt at the power
station for electricity (EVs, metro, e-bus). EVs are *not* zero-emission here: kWh drawn × the grid factor. Battery-side consumption
is grossed up by an assumed charging efficiency; transmission losses, fuel/electricity supply chains and vehicle/battery manufacturing
are outside the boundary and the UI says so.

* `emissionFactors.ts` — every factor with value, unit, year, geography, method, source, status (`primary` / `secondary` / `assumption`) and confidence.
  Electricity: CEA CO2 Baseline Database v22.0, national weighted-average grid rate, FY 2025-26 = 0.6751 kgCO2/kWh (not a CDM margin).
* `emissionsEngine.ts` — `calculateJourney()`: result, formulas with substituted inputs, factors, assumptions, confidence, contract mode, eligibility.
* `efficiency.ts` — EV `kWh/km` from battery ÷ range (40.5 kWh / 325 km = 0.1246 kWh/km = 12.46 kWh/100 km), per-100-km or km/kWh inputs; validation bounds.
* `contractMapping.ts` — the contract's `TransportMode` numbers (never reordered). No mode exists for petrol two-wheelers, CNG or unknown vehicles: they are calculated off-chain only.
* `rewardPolicy.ts` — MissionEV's own rule (the contract enforces none of it): petrol/diesel/CNG journeys and zero-saving journeys are never signed.
* `rewardPreview.ts` — integer-exact replica of the contract's reward arithmetic, tested against the compiled contract.

Efficiency is a supporting metric: a bigger battery or longer range is **not** more efficient; only lower kWh/km is. There is no invented efficiency multiplier, because the contract has none.

## Where things live

| Area | Path |
|---|---|
| Contract source, ABI, proposed v2 | `contracts/`, `src/lib/contract/missionev.abi.ts` (generated), `contracts/proposed/` |
| Carbon engine | `src/lib/carbon/` |
| Transport profile, model catalogue (names only), ride-hail | `src/lib/transport/`, `src/data/vehicle-catalog.json` |
| Receipt OCR parsing | `src/lib/ocr/receipt.ts` |
| EIP-712 payload, wallet proof, signer (server only) | `src/lib/oracle/`, `src/server/` |
| API routes | `src/app/api/**` |
| Trip state, settlement flow | `src/providers/trip-provider.tsx`, `src/components/trip/` |
| Tests | `tests/` (vitest) |

## Environment variables

Copy `.env.example` to `.env.local`. **Server-only** (never `NEXT_PUBLIC_`): `ORACLE_PRIVATE_KEY`, `MISSIONEV_CONTRACT_ADDRESS`,
`PORTAL_RPC_URL`, `AZURE_VISION_ENDPOINT`, `AZURE_VISION_KEY`, `ORACLE_SIGNATURE_TTL_SECONDS`, `ORACLE_MAX_TRIPS_PER_DAY`.
**Public:** `NEXT_PUBLIC_MEV_CONTRACT_ADDRESS`, `NEXT_PUBLIC_PORTAL_RPC_URL`, `NEXT_PUBLIC_PORTAL_CURRENCY_SYMBOL`,
`NEXT_PUBLIC_PORTAL_EXPLORER_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `NEXT_PUBLIC_AZURE_MAPS_KEY` (map keys are visible to every visitor: restrict them by domain).
Use a **fresh** oracle key whose address is the contract's `azureOracleSigner`.

## Data rules (keep them)

No full mobile numbers stored (masked only); no raw GPS paths persisted (coordinates rounded to ~110 m; samples go to the oracle only for the
request and are not stored); no wallet addresses or vehicle identifiers in analytics exports; registration numbers kept only masked;
receipt images never stored; mock data stays labelled DEMO.

## Maps

Basemap, first available wins: Google Maps (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`) → Azure Maps (`NEXT_PUBLIC_AZURE_MAPS_KEY`) → keyless OpenStreetMap
(Leaflet). A provider that fails at runtime hands over to the next; a labelled offline demo map is the last resort. A metro layer
(OpenRailwayMap on OSM, Google transit layer on Google) is on by default for metro trips.

## Theme

Colours are CSS variables in `src/app/globals.css` (light by default, `:root[data-theme="dark"]` overrides). Charts and the map read the variables.
