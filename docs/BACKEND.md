# Backend: route handlers and the oracle

The server is Next.js route handlers in `src/app/api/**`, with logic in `src/server/` and `src/lib/`. All settings are read from server-only
environment variables (`src/server/config.ts`); none carries a `NEXT_PUBLIC_` prefix, so none can reach the browser bundle.

## Routes

| Route | Method | Purpose | Limits and notes |
|---|---|---|---|
| `/api/status` | GET | What the server has configured, never the secrets; `mode` is `LIVE` only when contract address, RPC URL and oracle key are all set | Read at request time |
| `/api/chain` | GET | A live, read-only look at Portal V3 and the deployed contract: newest block and its age, contract code size, token, total $MEV supply, oracle signer, owner, and whether the EIP-712 domain matches. Needs no key and sends nothing; says so plainly when the public RPC is down | Works with no configuration (falls back to the public deployment); cached for 15 s to spare the shared RPC |
| `/api/trips/calculate` | POST | The shared carbon engine as a service; signs and changes nothing | |
| `/api/trips/verify` | POST | Runs the oracle's checks on trip evidence without signing | The wallet proof is ignored here |
| `/api/sign-trip` | POST | **The verifier node (oracle signer).** Re-verifies, calculates the CO2 avoided itself and signs the exact EIP-712 `TripPayload` for chain 420420777 | 20 per minute per IP; body up to 2 MB |
| `/api/commuter/:address` | GET | The commuter's on-chain profile and current nonce | Read from the RPC |
| `/api/rewards/:address` | GET | The real `$MEV` balance (`balanceOf`) plus streak and score, as decimal strings of wei so nothing is rounded | |
| `/api/trips/:tripId` | GET | What the oracle signed for this trip id (from this server's memory) and whether the contract has processed it | Memory is empty after a restart; the on-chain `processedTrips` flag is the durable truth |

There is no OCR route: receipt images are read in the browser by Tesseract.js and never reach the server (see [`FRONTEND.md`](FRONTEND.md)).
There is no sign-in route either: the account is the wallet address MetaMask shares in the browser, and the server issues no session.
What the server relies on is the fresh wallet signature sent with each reward request (rule 2 below).

## The verifier node: `POST /api/sign-trip`

Request: the commuter address, a wallet proof (message and signature), and the trip evidence (client trip id, journey mode, source, start and
end times, distance, duration, `[lat, lng, t, speed]` samples, occupants, vehicle). Everything is validated first (types, ranges, up to
20,000 samples).

It then applies these rules in order and returns the first that fails:

| # | Rule | Result if it fails |
|---|---|---|
| 1 | The server is configured (contract, RPC, oracle key) | 503 `unavailable` |
| 2 | The wallet proof matches this commuter, trip, contract and chain, is under 5 minutes old, and was signed by the commuter's address | 401 `unauthorized` |
| 3 | The trip is real GPS, not simulated | 422 `refused` |
| 4 | The reported distance is within 10% of the distance the server computes from the samples | 422 `refused` |
| 5 | The verification checks pass (vehicle profile, ride log, motion, route) | 422 `refused`, with the failed checks |
| 6 | The carbon engine can calculate the journey | 400 `invalid` |
| 7 | The reward policy allows it: a clean mode the contract knows, and more than 0 g avoided. Petrol, diesel and CNG are never rewarded | 422 `refused`, with the calculation |
| 8 | The commuter is under the daily limit (default 8 signed journeys a UTC day) | 429 `rate-limited` |
| 9 | The configured key is the contract's oracle signer, and the trip is not already in `processedTrips` | 503 `unavailable` / 409 `duplicate` |
| 10 | The nonce is read from the chain and the payload is signed with a deadline (default 600 s, at most 3600 s) | 200 `signed` |

Only values the server derived itself are signed. The private key is read from `ORACLE_PRIVATE_KEY` and never leaves the process.

## Configuration

| Variable | Scope | Needed for |
|---|---|---|
| `ORACLE_PRIVATE_KEY` | server only | LIVE: signing key of the contract's oracle signer |
| `MISSIONEV_CONTRACT_ADDRESS` | server only (falls back to the public one) | LIVE |
| `PORTAL_RPC_URL` | server only (falls back to the public one) | LIVE: nonce and state reads |
| `ORACLE_SIGNATURE_TTL_SECONDS`, `ORACLE_MAX_TRIPS_PER_DAY` | server only | Optional tuning |

DEMO versus LIVE is decided in one place: a journey is LIVE only if it was captured with real GPS, the server reports `LIVE`, and a real
wallet is connected on chain 420420777. A DEMO result is never presented as an on-chain transaction.

## Data and privacy rules

* No phone number, name or e-mail is collected, and the server stores nothing about a commuter; the account is a public wallet address.
* No raw GPS path is persisted: coordinates are rounded to about 110 m, and samples go to the oracle only for the request.
* No wallet addresses or vehicle identifiers appear in analytics exports; registration numbers are kept only masked.
* Receipt images are never stored, and never uploaded: they are read in the browser. Driver names and number plates are never read out.
* Mock data stays labelled DEMO.

## Limits

The rate limiters and the signed-trip log are in process memory (they stand in for a future database), so they reset on
restart and are per instance. See [`INTEGRATION_REPORT.md`](INTEGRATION_REPORT.md) for the full real-versus-simulated table.
