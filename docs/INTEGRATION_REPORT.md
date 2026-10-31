# MissionEV upgrade — what is real, what is simulated, what was tested

Date of this report: 2026-10-31. This describes the repository as it stands; nothing here was deployed anywhere.

## Architecture as built

```
Client (Next.js 16, React 19)        Server (Next route handlers = the Node.js API layer)        Chain
────────────────────────────         ──────────────────────────────────────────────────         ─────
sign-in → transport profile  ──►     /api/auth/otp/{request,verify}   MOCK (demo OTP)
journey mode chosen per trip ──►     /api/vision/ocr                  Azure AI Vision Read (needs keys)
GPS capture + local checks   ──►     /api/trips/calculate, /verify    shared carbon engine / oracle checks
wallet signs a free proof    ──►     /api/oracle/sign-trip            re-verify → recalc → EIP-712 sign
wallet sends recordCommute   ───────────────────────────────────────────────────────────────►  MissionEV.sol
read back balance / profile  ◄──     /api/commuter/:a, /api/rewards/:a, /api/trips/:id  (RPC reads)
```

The "Azure Functions" layer is implemented as Next route handlers because that is the project's existing routing. They are plain
`Request → Response` functions with the logic in `src/server/*` and `src/lib/*`, so porting them to Azure Functions (or hosting
the Next app on Azure) needs only a thin wrapper. **No Azure Function, Azure Maps routing, Cosmos DB or Power BI is deployed or
called by this code**, other than the optional Azure AI Vision call described below.

## Real vs simulated

| Area | State | Notes |
|---|---|---|
| Carbon engine (`src/lib/carbon`) | **Real** | One boundary (direct energy-use emissions) for every mode; each result carries formula, inputs, factor ids, sources, year, confidence, assumptions. 38 unit tests. |
| Grid emission factor | **Real, primary source** | CEA CO2 Baseline Database v22.0 (workbook dated 2026-08-01), *weighted-average grid emission rate incl. RES and captive, adjusted for imports*, FY 2025-26 = 0.6751 tCO2/MWh; ten years stored. Chosen over the CDM operating/build/combined margins on purpose: those are marginal factors for project baselines, not the average emission of electricity consumed. National figure: the database has no Delhi factor. |
| Petrol/diesel factors | **Secondary source** | 2.232 / 2.675 kgCO2e per litre, tank-to-wheel, as reported for the Smart Freight Centre India defaults (2025) via Climatiq. The original PDF refused a direct download, so these are flagged `secondary` and should be checked. |
| CNG factor | **Unverified** | Computed from IPCC 2006 defaults from memory; flagged `assumption`; only reachable through a ride-hail confirmation and never rewarded. |
| Metro / e-bus intensity | **Low-confidence placeholders** | Metro 0.041 kWh/passenger-km derived from a TERI table read second-hand; e-bus from one Kolkata case study plus an **unsourced** 25-passenger load. Both flagged `assumption`, confidence `low`. Replace with DMRC / operator figures. |
| Reference journeys | **Assumptions** | Petrol car 18 km/l, petrol two-wheeler 50 km/l (carried over from the earlier prototype). Not fleet statistics. |
| EV charging loss | **Assumption** | 90% applied to battery-side consumption only; unsourced. Transmission & distribution losses and battery manufacturing are outside the boundary and the UI says so. |
| Vehicle model catalogue | **Names only** | `src/data/vehicle-catalog.json` ships **no** efficiency figures. "Don't know your mileage?" therefore never finds a manufacturer figure; it falls back to the commuter's estimate or a labelled category default (low confidence). Add cited figures to the JSON to enable look-ups. |
| Vehicle profile | **Self-declared** | No registry. Stored in `sessionStorage` (D1). |
| Phone / OTP | **Mock** | Fixed demo OTP; server routes exist and check it, rate-limited, but this is **not authentication** and no SMS is sent. The UI says "DEMO OTP — no SMS is sent". |
| Receipt OCR | **Adapter, untested against Azure** | `POST /api/vision/ocr` calls Azure AI Vision Image Analysis 4.0 (Read) when `AZURE_VISION_ENDPOINT`/`KEY` are set; otherwise answers 501 and the UI switches to manual entry. **No Azure key was available, so the Azure call itself has never been run.** The receipt parser was tested only on synthetic text (no real Ola/Uber/Rapido receipts were available), so field extraction on real receipts is unproven. Images are held in memory for one request, never stored or logged; driver names/plates are never read out. |
| Ride-hail classification | **User-confirmed** | The vehicle that carried the commuter (model, body, fuel) is confirmed by the commuter; OCR is only a suggestion. No access to Ola/Uber/Rapido data. An electric cab maps to EV_CAR/EV_2W; petrol/diesel/CNG cabs are never rewarded. A receipt distance within ±15% of the GPS distance is required. |
| Oracle signing | **Real code, verified locally** | Re-verifies the evidence, recomputes distance and emissions, applies the reward policy, reads the nonce from the chain, signs the exact EIP-712 payload (viem). **Tested against the compiled contract in-process and in a browser against a local dev chain; never run against Portal V3.** |
| Wallet transaction | **Real EIP-1193** | `recordCommute` is sent by the commuter's own wallet; receipt, minted amount (from `Transfer` logs) and `getCommuter` are read back. Browser-tested with a **mock** wallet, not MetaMask. |
| Portal V3 | **Not connected** | No RPC URL, contract address or oracle key exist in this repo, so the app is DEMO until you set them. |
| Redemptions | **Simulated** | The contract has no `redeem`/`burn`. Redemptions are local D4 records; on-chain balance is unchanged and the UI says so. |
| Analytics community data | **Synthetic** | Same as before (deterministic, 42 invented commuters), now generated through the same engine and policy. |
| Cosmos DB / Power BI / indexer | **Not integrated** | |

## How a journey is decided

Ownership never decides a journey. Each trip asks "How did you travel for this journey?":

* private EV / petrol / diesel / two-wheeler → needs a matching saved vehicle (blocked with a clear message otherwise)
* Ola / Uber / Rapido → receipt details + confirmed vehicle; calculated from *that* vehicle
* metro, electric bus, walking/cycling → no vehicle needed

Reward policy (`src/lib/carbon/rewardPolicy.ts`, **MissionEV's rule, not the contract's**): petrol/diesel/CNG journeys are measured
and shown but never signed; zero avoided grams is never signed; journeys the contract has no mode for (petrol two-wheeler, CNG)
are calculated off-chain only; simulated trips are never signed. A journey above the reference shows "Your journey emitted more
than the reference scenario" and nothing negative is ever sent on-chain.

Enum mapping (`src/lib/carbon/contractMapping.ts`, numbers never reordered): EV car 0, EV two-wheeler 1, metro 2, e-bus 3,
walking/cycling 4, petrol/diesel car 5, SUV 6; petrol two-wheeler, CNG and unknown → unsupported.

## Configuration (server-only unless noted)

`ORACLE_PRIVATE_KEY`, `MISSIONEV_CONTRACT_ADDRESS`, `PORTAL_RPC_URL`, `AZURE_VISION_ENDPOINT`, `AZURE_VISION_KEY`,
`ORACLE_SIGNATURE_TTL_SECONDS` (default 600, max 3600), `ORACLE_MAX_TRIPS_PER_DAY` (default 8). Public: `NEXT_PUBLIC_MEV_CONTRACT_ADDRESS`,
`NEXT_PUBLIC_PORTAL_RPC_URL` (+ the existing map keys). A test asserts no secret has a `NEXT_PUBLIC_` spelling and that the signer
module is imported only from `src/server`. **Use a fresh oracle key; do not reuse any key that was ever pasted or exposed.**

## Try the LIVE flow without any real network

```bash
npm run contract:compile        # builds contracts/artifacts (committed already)
npm run dev:chain               # in-memory EVM + the real contract; prints the env vars for .env.local
npm run dev                     # in another terminal, after copying those env vars
```
Then connect a wallet on chain 420420777 pointing at `http://127.0.0.1:8545`. The dev chain is DEV ONLY (every `from` is unlocked,
nothing persists).

## Tests that were actually run

* `npm test` — 104 tests, 5 files: carbon engine, contract (compiled `MissionEV` and proposed `MissionEVv2` executed in an
  in-process EVM with Portal V3's chain id), oracle decision logic against the real contract, registration/ride-hail/receipt parsing,
  route handlers and secret hygiene.
* `npx tsc --noEmit`, `npx eslint src tests scripts` — clean. `npx next build` — passes (Next 16, Cache Components).
* Browser (Microsoft Edge via playwright-core): DEMO flow (sign-in → multi-vehicle profile → metro, EV, petrol, ride-hail petrol and
  EV cab → demo credit → rewards → analytics) and LIVE flow (local chain + oracle + mock wallet → real-GPS EV trip → oracle signature
  → wallet transaction → on-chain balance equals the formula) — results in the final summary.
* Viewports 1440×900, 1280×800, 1024×768, 768×1024, 390×844, 360×800 on Register, Capture Trip (EV and ride-hail), Rewards, Analytics:
  no page-level horizontal scroll at any size. (Rewards' category chips are an intentional horizontally scrolling strip at ≤390 px.)

## Known limitations

* Oracle rate-limit and duplicate memory are in process memory (reset on restart; per-instance on serverless). A durable store is required before real use.
* GPS evidence can be spoofed by a device that controls its own location; the checks catch implausible traces, not a determined spoofer. The saved vehicle and its efficiency are self-declared.
* Trip evidence (location samples) is held only in memory in the browser, so a signature can be requested only before the page is reloaded.
* The wallet connection is restored silently after a reload only if it was connected in the same tab and not disconnected.
* The visual theme is the app's existing light/dark system, not the specific #080B10/#101823 palette in the brief; I did not restyle the product.
* Several earlier screens still carry some wording from the old design (e.g. step labels); the main flows were updated, not every string audited.
