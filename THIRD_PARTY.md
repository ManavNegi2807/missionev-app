# Third-party code, data and services

Everything below is used under its own licence or terms. Nothing here has been copied into the repository: packages are installed from
npm, and data sources are cited in `src/lib/carbon/emissionFactors.ts` (value, unit, year, geography, method, source, status, confidence).
Licences were read from the installed packages (`node_modules/<name>/package.json`).

## npm packages (direct dependencies)

| Package | Version | Licence | Used for |
|---|---|---|---|
| next | 16.4.3 | MIT | App framework (App Router, route handlers) |
| react, react-dom, react-is | 19.3.0 | MIT | UI |
| viem | 2.57.13 | MIT | EIP-712 signing, RPC reads, ABI encoding, deploy scripts |
| recharts | 3.10.1 | MIT | Analytics charts |
| lucide-react | 1.65.0 | ISC | Icons |
| leaflet | 1.9.4 | BSD-2-Clause | Keyless OpenStreetMap basemap |
| azure-maps-control | 3.7.4 | "See LICENSE.TXT" (Microsoft terms) | Optional Azure Maps basemap, only loaded if `NEXT_PUBLIC_AZURE_MAPS_KEY` is set |

## npm packages (development and test only)

| Package | Version | Licence | Used for |
|---|---|---|---|
| typescript | 5.9.3 | Apache-2.0 | Type checking |
| eslint, eslint-config-next | 9.39.5, 16.4.3 | MIT | Linting |
| tailwindcss, @tailwindcss/turbopack | 4.3.3 | MIT | Styling |
| vitest | 4.1.12 | MIT | Test runner |
| solc | 0.8.34 | MIT | Compiling the contract (`npm run contract:compile`) |
| @ethereumjs/vm, evm, util, block | 10.1.3 | MPL-2.0 | In-process EVM that runs the compiled contract in tests and in `npm run dev:chain` |
| @ethereumjs/common | 10.1.3 | MIT | Chain configuration for the in-process EVM |
| @types/* (node, react, react-dom, leaflet, google.maps) | various | MIT | Type definitions |

## Fonts

Geist and Geist Mono, loaded through `next/font/google` (SIL Open Font Licence 1.1).

## Data sources behind the carbon numbers

| Data | Source | Status in the code |
|---|---|---|
| Grid emission factor, FY 2016-17 to 2025-26 (FY 2025-26 = 0.6751 kgCO2/kWh) | Central Electricity Authority, CO2 Baseline Database for the Indian Power Sector, v22.0 (weighted-average rate incl. RES and captive, adjusted for imports) | `primary` |
| Petrol 2.232 and diesel 2.675 kgCO2e per litre | Smart Freight Centre India defaults (2025), read second-hand via Climatiq because the original PDF could not be downloaded | `secondary`, to be checked |
| CNG factor | Computed from IPCC 2006 default values, from memory | `assumption`, unverified, never rewarded |
| Metro 0.041 kWh per passenger-km | A TERI table read second-hand | `assumption`, low confidence |
| Electric bus intensity | One Kolkata case study plus an unsourced 25-passenger load | `assumption`, low confidence |
| Reference journeys: petrol car 18 km/l, petrol two-wheeler 50 km/l | MissionEV's own scenario, carried over from an earlier prototype | `assumption`, not fleet statistics |
| EV charging efficiency 90% | MissionEV's own assumption, unsourced | `assumption` |

Details and caveats: [`docs/INTEGRATION_REPORT.md`](docs/INTEGRATION_REPORT.md).

## Map tiles and services

| Service | Terms | When it is called |
|---|---|---|
| OpenStreetMap tiles (`tile.openstreetmap.org`) | ODbL data, [tile usage policy](https://operations.osmfoundation.org/policies/tiles/); fine for a demo, not for heavy traffic | Default basemap, no key |
| OpenRailwayMap tiles | CC-BY-SA | Metro overlay on OSM |
| Google Maps JavaScript API | Google terms; needs a key | Only if `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is set |
| Azure Maps | Microsoft terms; needs a key | Only if `NEXT_PUBLIC_AZURE_MAPS_KEY` is set |
| Azure AI Vision (Image Analysis 4.0, Read) | Microsoft terms; needs a key | Only if `AZURE_VISION_ENDPOINT` and `AZURE_VISION_KEY` are set; the code path has not been run against the real service |
| Portal V3 EVM RPC `https://test-evm-rpc-v3.portaldot.dev` | Portaldot testnet | Oracle nonce/state reads and contract deployment |
| Community indexer `portalindex-98f0.onrender.com` | Shared in the Portaldot Discord | Used by hand to confirm deployments; the app does not depend on it |

## Contract code

`contracts/MissionEV.sol` (MIT, per its SPDX header) was supplied as the project's contract and is kept verbatim.
`contracts/proposed/MissionEVv2.sol` is the same contract with the fixes listed in [`docs/CONTRACT_AUDIT.md`](docs/CONTRACT_AUDIT.md).
It is written in the plain ERC-20 style but does not import OpenZeppelin or any other library.

## AI-assisted development

Much of the upgrade after the first front-end commit (carbon engine, oracle service, contract integration, tests, deployment tooling and
the documentation) was written with Claude Code, Anthropic's coding agent, working in this repository under the developer's direction.
Commits made that way carry a `Co-Authored-By` trailer. The contract deployment was run by the developer on their own machine, with their own keys.
