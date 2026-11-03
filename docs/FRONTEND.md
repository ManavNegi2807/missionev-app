# Frontend

Next.js 16 (App Router, Cache Components), React 19, Tailwind v4, recharts. `/` redirects to `/register`.

## The four screens

| Screen | Route | What it does |
|---|---|---|
| 01 Sign-in and transport profile | `/register` | Phone number and a **demo** one-time password (no SMS is sent). Then "How do you usually commute?": ten modes (EV car, electric two-wheeler, petrol car, diesel car, petrol two-wheeler, Ola/Uber/Rapido, metro, electric bus, walking or cycling, other). Vehicles are saved with battery and range (EV, converted to kWh per km) or km per litre (petrol, diesel). "Don't know your mileage?" falls back to a labelled, low-confidence category default; the app never invents a model-specific figure |
| 02 Capture trip | `/capture-trip` | Pick **how you travelled for this trip** (eight tiles), then record with real GPS or a labelled simulation. Shows live telemetry, a map, the verification engine (four checks, then a trust level), the carbon comparison with its formula, sources and confidence, an illustrative $MEV preview, and the settlement panel (credit in the demo, or sign and record on-chain) |
| 03 Rewards | `/rewards` | $MEV balance (a labelled demo balance, or the real `balanceOf` when a real wallet is on Portal V3), the separate tPOT gas balance, journey and reward KPIs, a **simulated** redemption catalogue, and on-chain activity |
| 04 ESG analytics | `/analytics` | Charts, a journey table, a leaderboard, definitions and data sources. Community data is deterministic and synthetic, and says so |

Ride-hail trips (Ola, Uber, Rapido) ask for the receipt details (read in the browser by Tesseract.js, with electric vehicles flagged, or typed by hand) and for the
commuter to confirm the vehicle that carried them. The journey is calculated from that vehicle, not from the commuter's own.

## State

| Provider (`src/providers/`) | Holds |
|---|---|
| `onboarding-provider` | Masked phone, transport profile and saved vehicles (the "D1" record) |
| `wallet-provider` | EIP-1193 wallet connection, chain check and add-network, silent restore of a previous connection |
| `trip-provider` | The trip state machine (idle, recording, paused, completed, verifying, verified or failed), DEMO versus LIVE, and the settlement flow (credit demo, request signature, submit on-chain) |
| `rewards-provider` | Demo and on-chain balances, demo credits and simulated redemptions |

Trips, registration and redemptions live in `sessionStorage` for the browser tab (coordinates rounded to about 110 m), shared across the
screens. Nothing is sent to a database.

## Components

`src/components/` is split by screen: `register/`, `trip/` (session panel, KPI grid, map, verification engine, emissions card, ledger
panel, ride-hail section, history), `rewards/`, `analytics/`, `shell/` (sidebar, top bar, wallet, status), `ui/` (primitives) and `brand/`.

## Map

The default is **Leaflet on OpenStreetMap tiles**: no key, a green planned route (dashed) and captured trail (solid), and dark-mode tiles when
the theme is dark (the same tiles recoloured with a CSS filter, so no third-party dark tile host is involved). A Google Maps key
(`NEXT_PUBLIC_GOOGLE_MAPS_KEY`) overrides it if you set one. A provider that fails at runtime hands over to the next, and a labelled
offline demo map is the last resort. A metro overlay (OpenRailwayMap on OSM, Google's transit layer on Google) is on by default for
metro trips.

## Receipt OCR

Ride receipts are read in the browser by Tesseract.js (`src/lib/ocr/scan.ts`): the screenshot is never uploaded to the app's server. The
text goes through `parseReceipt` (`src/lib/ocr/receipt.ts`), which suggests the provider, distance, date and vehicle and **flags electric
vehicles**, either because the model matches an electric entry in the catalogue or because the receipt says EV or electric. The flag only
pre-fills the form; the commuter still confirms the vehicle and fuel. The first scan downloads the OCR engine from a public CDN.

## Theme and layout

Colours are CSS variables in `src/app/globals.css`: light by default, `:root[data-theme="dark"]` overrides, toggled from the top bar. Charts
and the map read the variables. The layout was checked in a real browser from 1440 px down to 360 px wide with no horizontal overflow, and
labels wrap instead of being clipped, so the DEMO and "not on-chain" labels are never cut off.

## Honest labelling

Every simulated result carries a DEMO label, a DEMO credit says "nothing was minted", and the on-chain section appears only when a real
wallet on chain 420420777 and a configured server are present. The UI states that $MEV is a prototype reward token, not a certified carbon
credit, and that estimated emissions, avoided emissions, the reward preview, the real $MEV balance, tPOT gas and certified credits are
five different things.
