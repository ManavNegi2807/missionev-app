# MissionEV

Decentralised EV carbon tracking and **CarbonCoin ($MEV)** rewards, built for Build with Bharat 5.0 / Portaldot Hacker House 2026.
Four screens: **01 Sign-in & Register → 02 Capture Trip → 03 Rewards & Redeem → 04 ESG Analytics**.

This repository is the **front end only**. Everything that would need a backend is either a clearly labelled demo or
disabled. This file lists exactly where a backend plugs in.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm run start
```

Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind v4, viem, recharts. Light and dark theme (toggle in the top bar).
Next 16 has breaking changes from older versions; see `AGENTS.md` and `node_modules/next/dist/docs/` before changing framework-level code.

## What is real and what is demo

| Area | State today | Where |
|---|---|---|
| Wallet connect (MetaMask-style `window.ethereum`) | **Real** when a wallet is installed; otherwise "Demo mode" | `src/providers/wallet-provider.tsx` |
| Portal V3 (chain id `420420777`) | Real chain switch / add (needs the RPC env vars) | `src/lib/chain.ts` |
| Vahan vehicle registry | **Mock** (deterministic by the last 4 characters of the number) | `src/lib/vahan.ts` |
| EV-maker ride-log check | **Mock** | `src/lib/trip/verification.ts` |
| GPS capture | Real browser geolocation, or a labelled simulation | `src/components/trip/` |
| Trip verification, trust tier, emissions maths | Real logic, runs in the browser | `src/lib/trip/` |
| `MissionEVRewards.submitTrip` | **Not callable**: oracle-only, no deployed address or ABI in this repo. Only a preview (real keccak hash and ABI-encoded calldata) is built | `src/lib/trip/ledger.ts` |
| Reading $MEV balance, `TripRecorded` / `Redeemed` events, `redeem()` | Real, but only if `NEXT_PUBLIC_MEV_CONTRACT_ADDRESS` is set and a real wallet is connected | `src/lib/rewards/chain.ts` |
| Rewards catalogue and redemptions | **Demo**, stored in the browser | `src/lib/rewards/` |
| Analytics community data | **Synthetic**, seeded and deterministic (42 invented commuters). Your own trips are mixed in | `src/lib/analytics/demo-data.ts` |
| Azure Maps | Optional; falls back to a labelled demo map without a key | `src/lib/maps/azure.ts` |
| Azure Cosmos DB, Power BI, city-planner reporting | **Not integrated** (the UI says so) | `src/components/analytics/data-sources.tsx` |

## Where the backend goes

The four data stores in the workflow diagram (D1–D4) are currently **browser `sessionStorage`**. These are the keys:

| Store | Key | Holds |
|---|---|---|
| D1 Users & Vehicles | `missionev:d1:registration` | wallet, masked registration, vehicle, registry result |
| D2 Trips & Telemetry | `missionev:d2:trips` | verified/failed trips (coordinates rounded to ~110 m, no raw path) |
| D3 (demo) | `missionev:d3demo:grants` | demo reward top-ups |
| D4 Redemptions | `missionev:d4:redemptions` | demo redemptions |

Suggested order of work:

1. **Vehicle registry adapter.** Implement `VehicleRegistryAdapter` (`lookup(input, signal) → RegistryResult`) and return it from `getRegistryAdapter()` in `src/lib/vahan.ts`. The UI needs no change. Do the real call server-side (a Next route handler); never ship registry credentials to the browser.
2. **Persistence.** Replace the `sessionStorage` reads/writes (`src/lib/session-store.ts`, providers in `src/providers/`) with API calls to a database (Cosmos DB was the plan). The analytics screen already builds its dataset from D1–D4 in `src/lib/analytics/dataset.ts`; give it real rows and the dashboard follows.
3. **Reward oracle service.** `submitTrip(address _user, bytes32 _tripHash, uint256 _vehicleId, uint256 _distanceMeters, uint8 _trust)` is `onlyOracle`, so a commuter's wallet can never call it; the backend holds the oracle key. The front end already produces the trip hash and calldata (`buildLedgerPreview` in `src/lib/trip/ledger.ts`). A backend should re-verify the trip itself, then submit. **Do not trust the client's verification result.**
4. **Contract address and ABI.** Set `NEXT_PUBLIC_MEV_CONTRACT_ADDRESS`. The Solidity source and compiled ABI are not in this repo.
5. **Indexer.** On-chain history currently covers only the connected wallet. Community-wide analytics need an event indexer for `TripRecorded` and `Redeemed`.

Data rules the UI already follows, please keep them: no full registration numbers stored, no raw GPS paths persisted, no wallet addresses or vehicle identifiers in analytics exports, and mock data stays labelled DEMO.

## Environment variables

Copy `.env.example` to `.env.local`. All are optional and all are `NEXT_PUBLIC_` (visible in the browser), so **never put secrets in them**.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_PORTAL_RPC_URL`, `NEXT_PUBLIC_PORTAL_CURRENCY_SYMBOL`, `NEXT_PUBLIC_PORTAL_EXPLORER_URL` | Lets the wallet add Portal V3 if it is missing |
| `NEXT_PUBLIC_MEV_CONTRACT_ADDRESS` | Enables live $MEV reads and redeem |
| `NEXT_PUBLIC_AZURE_MAPS_KEY` | Real basemap on the Capture Trip screen. A browser key is exposed to users, so restrict it by domain in Azure |

Secrets (oracle private key, registry credentials, database connection strings) belong in **server-only** env vars on your host, read in route handlers.

## Shared maths

Emissions, tokens and trust tiers are defined once in `src/lib/trip/emissions.ts`. The Rewards and Analytics screens reuse it, so the numbers agree across screens. If you move this logic to the server, keep one implementation and test that both give the same grams and tokens for the same trip.

## Theme

Colours are CSS variables in `src/app/globals.css` (light by default, `:root[data-theme="dark"]` overrides). Charts and the map read the variables, so a new component only needs the token classes (`bg-panel`, `text-muted`, `border-line`, …) to work in both themes.
