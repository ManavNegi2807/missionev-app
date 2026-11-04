# MissionEV upgrade — what is real, what is simulated, what was tested

Date of this report: 2026-10-31, updated 2026-11-04. This describes the repository as it stands. The contract was deployed to Portal V3 on
2026-11-03 (see the Portal V3 row). On 2026-11-04 the stack became fully open source: Leaflet and OpenStreetMap for the map, Tesseract.js
for receipt OCR, and the verifier node at `/api/sign-trip`.

## Architecture as built

```
Client (Next.js 16, React 19)        Server (Next route handlers = the Node.js API layer)        Chain
────────────────────────────         ──────────────────────────────────────────────────         ─────
wallet sign-in → profile             (no server call: the address MetaMask shares is the account)
journey mode chosen per trip        (receipt OCR runs in the browser with Tesseract.js: no upload)
GPS capture + local checks   ──►     /api/trips/calculate, /verify    shared carbon engine / verifier checks
wallet signs a free proof    ──►     /api/sign-trip                   re-verify → recalc → EIP-712 sign
wallet sends recordCommute   ───────────────────────────────────────────────────────────────►  MissionEV.sol
read back balance / profile  ◄──     /api/commuter/:a, /api/rewards/:a, /api/trips/:id  (RPC reads)
```

The verifier node (the oracle signer) is implemented as Next route handlers. They are plain `Request → Response` functions with the
logic in `src/server/*` and `src/lib/*`, so they run on any Node host. **No hosted function platform, managed database, BI tool or paid
maps, routing or OCR service is called by this code.**

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
| Vehicle profile | **Self-declared** | No registry. Stored in `sessionStorage`. |
| Sign-in | **Wallet connection, or a labelled demo account** | The account is the public address MetaMask shares through `eth_requestAccounts`; no phone number, e-mail or password exists anywhere. It is a connection, not a signed login message, and no server session is issued, so it is not proof of identity: the verifier node instead re-checks a fresh wallet signature on every reward request. A demo account has no wallet and nothing it does is on-chain. Browser-tested with a scriptable mock wallet (reject, wrong network, add network, account switch, lock, reload, sign out), **not** with the MetaMask extension itself. |
| Receipt OCR | **Real engine, tried on rendered samples** | Tesseract.js (open source) reads the screenshot **in the browser**: the image is never uploaded to the app's server. The first scan downloads the engine from a public CDN. Verified in a real browser on two rendered sample receipts (provider, distance, date and vehicle read; an electric model flagged; a petrol car not flagged; an image with no text falls back to manual entry). **No real Ola/Uber/Rapido receipt was available**, so accuracy on real screenshots is unproven. EVs are flagged from the model list or from EV wording, but the commuter still confirms the fuel. Driver names and plates are never read out. |
| Ride-hail classification | **User-confirmed** | The vehicle that carried the commuter (model, body, fuel) is confirmed by the commuter; OCR is only a suggestion. No access to Ola/Uber/Rapido data. An electric cab maps to EV_CAR/EV_2W; petrol/diesel/CNG cabs are never rewarded. A receipt distance within ±15% of the GPS distance is required. |
| Oracle signing | **Real code, verified locally** | Re-verifies the evidence, recomputes distance and emissions, applies the reward policy, reads the nonce from the chain, signs the exact EIP-712 payload (viem). **Tested against the compiled contract in-process and in a browser against a local dev chain; never run against Portal V3.** |
| Wallet transaction | **Real EIP-1193** | `recordCommute` is sent by the commuter's own wallet; receipt, minted amount (from `Transfer` logs) and `getCommuter` are read back. Browser-tested with a **mock** wallet, not MetaMask. |
| Portal V3 | **Contract deployed and verified; app not connected** | v2 is live at `0x0904244017324dc1bf7c611fe1236936ee65fc82` (tx `0x11562d9b…ca965`, block 309126) and `npm run contract:verify` confirms its code, domain separator, owner and oracle. The repo still holds no RPC URL, contract address or oracle key, so the app is DEMO until a server is given them. No `recordCommute` has been sent to the deployed contract yet. On 2026-11-04 the verifier node, running the real code and the real oracle key against the real chain, signed a metro trip and the deployed contract accepted it in an `eth_call` simulation; a tampered copy and a different commuter were both rejected. Nothing was sent. One `recordCommute` is estimated at about 35 tPOT at the gas price seen that day. |
| Live chain panel | **Real, read-only** | The landing page and `GET /api/chain` ask the public Portal V3 RPC for the newest block (flagged as lagging after 120 s, the same rule as `npm run network:health`), the contract code, token, supply, oracle signer, owner and `DOMAIN_SEPARATOR`, and compare the last three with the deployment record. No key, no wallet, nothing sent. On 4 November it returned: live, code 5,088 bytes, 0 $MEV minted, domain and deployment record matching. |
| Redemptions | **Simulated** | The contract has no `redeem`/`burn`. Redemptions are local records; on-chain balance is unchanged and the UI says so. |
| Analytics community data | **Synthetic** | Same as before (deterministic, 42 invented commuters), now generated through the same engine and policy. |
| Database / BI tool / indexer | **Not integrated** | |

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

`ORACLE_PRIVATE_KEY`, `MISSIONEV_CONTRACT_ADDRESS`, `PORTAL_RPC_URL`,
`ORACLE_SIGNATURE_TTL_SECONDS` (default 600, max 3600), `ORACLE_MAX_TRIPS_PER_DAY` (default 8). Public: `NEXT_PUBLIC_MEV_CONTRACT_ADDRESS`,
`NEXT_PUBLIC_PORTAL_RPC_URL` (+ the existing map keys). A test asserts no secret has a `NEXT_PUBLIC_` spelling and that the signer
module is imported only from `src/server`. **Use a fresh oracle key; do not reuse any key that was ever pasted or exposed.**

## Try the LIVE flow without any real network

```bash
npm run contract:compile        # builds contracts/artifacts (committed already)
npm run dev:chain               # in-memory EVM + the real contract; prints the env vars for .env.local
npm run dev                     # in another terminal, after copying those env vars
```
Then connect a wallet on chain 420420777 pointing at `http://127.0.0.1:8545`.

## Deploying the contract to Portal V3 (not done yet)

`scripts/deploy-contract.mjs` (`npm run contract:deploy -- --artifact MissionEVv2.proposed`) is a **dry run unless you pass `--confirm`**.
It refuses a wrong chain id (must be 420420777), a zero oracle address and a missing key, prints the deployer's tPOT balance and a gas
estimate, and after broadcasting reads the contract back (code present, the oracle signer, `owner`, `DOMAIN_SEPARATOR`) before
reporting success. Run it yourself so the deployer key stays on your machine:

```bash
DEPLOYER_PRIVATE_KEY=0x…  PORTAL_RPC_URL=https://…  ORACLE_ADDRESS=0x<public address of the NEW oracle key>  npm run contract:deploy -- --artifact MissionEVv2.proposed
```
A key-less preview needs only public information: `DEPLOYER_ADDRESS=0x… ORACLE_ADDRESS=0x… PORTAL_RPC_URL=https://… npm run contract:deploy -- --artifact MissionEV`.

**Measured on 2026-10-31 against `https://test-evm-rpc-v3.portaldot.dev` (read-only; nothing was sent):**
* The RPC is chain id 420420777. Use the `https://` URL: the `http://` one answers `301` and breaks JSON-RPC POSTs (the script now refuses plain http).
* Both contracts' constructors run correctly on Portal's EVM and return exactly the expected runtime code (4,245 bytes for v1, 5,088 for v2): no opcode-compatibility problem with `evmVersion: paris`.
* **Gas is metered very differently from a normal EVM.** `eth_estimateGas` returns huge numbers that grow steeply with code size: a plain transfer ≈ 4.8×10¹¹ gas, a 1-byte contract ≈ 13.4 tPOT, v1 ≈ **358 tPOT**, v2 ≈ **425 tPOT** (at the quoted gas price of 25,770 wei). A deployer holding 98.9 tPOT therefore cannot afford either, and the script refuses `--confirm` in that case. These are estimates: the actual fee was not measured because no transaction was sent. Either fund the deployer with roughly 450 tPOT, or measure a real small deployment first.
* The deployer address supplied had nonce 0 and the oracle address was an unused plain account (no code).

It was tested against the local dev chain (dry run, guards, a real broadcast with a throwaway key and all read-back checks) and, read-only, against Portal. The dev chain is DEV ONLY (every `from` is unlocked,
nothing persists).

## Tests that were actually run

* `npm test` — 100+ tests: carbon engine, contract (compiled `MissionEV` and proposed `MissionEVv2` executed in an
  in-process EVM with Portal V3's chain id), oracle decision logic against the real contract, registration/ride-hail/receipt parsing,
  route handlers and secret hygiene.
* `npm run typecheck` (`next typegen`, then `tsc --noEmit`), `npx eslint src tests scripts` — clean. `npx next build` — passes (Next 16, Cache Components).
* Browser (a Chromium browser, Edge, driven by playwright-core): DEMO flow (sign-in → multi-vehicle profile → metro, EV, petrol, ride-hail petrol and
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
* On 2026-11-04 the on-screen wording was audited: the process-number and data-store labels carried over from the design diagrams were removed, and the sign-in screen no longer mentions a phone number or OTP.
