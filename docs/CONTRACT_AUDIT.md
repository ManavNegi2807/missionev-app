# MissionEV.sol — security and compatibility audit

Scope: `contracts/MissionEV.sol` (the source supplied for this upgrade; it was **not** in the repo or workspace before, so it was
added verbatim). Compiled with `solc-js 0.8.34` (pinned in `package.json`), optimizer 200 runs, `evmVersion: paris`
(`npm run contract:compile` → `contracts/artifacts/MissionEV.json` and `src/lib/contract/missionev.abi.ts`).

**Deployment status:** no deployed address, ABI or deployment record existed. Nothing was deployed, and no address was
switched, by this work. Until `MISSIONEV_CONTRACT_ADDRESS` (+ RPC and oracle key) is configured the app runs in DEMO.

Every finding below was **demonstrated by executing the compiled contract** (`tests/contract.test.ts`, which also runs the
same cases against the proposed v2). Severity is my own judgement of impact on a prototype reward token.

| # | Finding | Severity | Demonstrated | Handled how today (no contract change) | v2 |
|---|---|---|---|---|---|
| F1 | Constructor accepts `address(0)` as oracle. `ecrecover` returns `address(0)` for any invalid signature, so with a zero oracle **any garbage signature passes** and anyone can mint up to the `uint32` limit. (`setAzureOracle` does reject zero; the constructor doesn't.) | **Critical** if deployed that way | yes | Deploy with a real oracle address; the server refuses to sign if the configured key isn't the on-chain `azureOracleSigner`. | rejects zero |
| F2 | No low-s check: a valid signature `(r,s,v)` has a second valid twin `(r, n−s, v⊕1)`. | Low (replay is still blocked by `processedTrips` and the nonce) | yes | none needed | rejects high-s |
| F3 | Signature length is not validated: a 66-byte blob is accepted (trailing byte ignored); shorter blobs read other calldata/zero. | Low | yes | client always sends 65 bytes | requires 65 |
| F4 | `v` is not range-checked (relies on `ecrecover` returning 0). | Info | – | viem returns v = 27/28 | requires 27/28 |
| F5 | A trip with **0 avoided grams still mints the mode bonus**: 10 MEV for EV_CAR / EV_2W / METRO, 15 MEV for ACTIVE. | Medium | yes | the oracle never signs a journey with 0 avoided grams (`rewardEligibility`) — this is a policy, not a guarantee | no bonus at 0 g (**behaviour change**) |
| F6 | Nothing on-chain ties reward to a *clean* mode: a signed ICE_CAR/ICE_SUV trip with avoided grams mints the full base reward. There is no ICE penalty, burn or negative value. | Medium (design) | yes | the oracle never signs petrol/diesel journeys | unchanged — an ICE penalty needs its own designed mechanism |
| F7 | No per-day cap: several unique trip ids on one calendar day all mint (only the streak counter is protected). | Medium | yes | per-commuter daily limit in the oracle (`ORACLE_MAX_TRIPS_PER_DAY`, default 8) — **in-memory, so it resets on restart**; a durable store is needed | unchanged — a product decision |
| F8 | The token is not a full ERC-20: no `transferFrom`, so `approve`/`allowance` do nothing; `transfer` accepts `address(0)` (tokens vanish while `totalSupply` is unchanged). | Medium | yes | the app never calls `approve` or `transferFrom` | adds `transferFrom`, rejects zero address |
| F9 | `CommuteVerified.pointsMinted` is `reward / 1e18` (truncated: 13.78 MEV is reported as 13). | Info | yes | the app reads exact amounts from `Transfer` logs and `balanceOf` | unchanged (ABI-compatible) |
| F10 | Trust and centralisation: one oracle key can sign arbitrary values for any commuter; there is no pause, no supply cap, no ownership transfer; `distanceMeters` is stored in the event but never used in the reward; the streak counts any signed trip. | Info | – | oracle recalculates everything itself; key lives only in server env | unchanged |
| F11 | A signature is bound to the commuter's *current* nonce, so only one signature per commuter can be outstanding; if the nonce moves first the signature reverts. | Info | yes | the app re-reads the nonce before sending and asks for a fresh signature | unchanged |

Checked and fine: EIP-712 domain (`name "MissionEV"`, `version "1"`, `block.chainid`, `address(this)`) and the
`TripPayload` type hash match what the app signs (tested against the compiled `DOMAIN_SEPARATOR()` and `TRIP_TYPEHASH()` on a
chain with Portal V3's id 420420777); the deadline check; the replay check; out-of-range `TransportMode` values revert;
the oracle refuses to sign any value that doesn't fit `uint32` (tested; the contract's own handling of an oversized value was not separately tested); a signature for commuter A cannot be used by B; changing any signed field
invalidates the signature; a signature for a different contract address is rejected.

## Proposed v2 (not deployed)

`contracts/proposed/MissionEVv2.sol` — same `recordCommute` ABI, enum numbering and EIP-712 payload, so the oracle and front end
work unchanged. Changes: F1, F2, F3, F4, F5 (behaviour change, needs product approval), F8. It compiles and passes the same
signing/recording/streak/reward-preview tests as v1 (and the extra F-tests).

**Migration if v2 is adopted:** it is a new contract at a new address. v1 balances, nonces, streaks, scores and processed trip
ids do **not** carry over; commuters restart at streak 0 and nonce 0. If balances matter, take a v1 snapshot and re-issue (an
airdrop script or a v2 `migrate` function — both need explicit design). Then: deploy v2 with the real oracle address, set
`MISSIONEV_CONTRACT_ADDRESS` / `NEXT_PUBLIC_MEV_CONTRACT_ADDRESS`, re-point the indexer. **No deployment or address switch has been done
and none should happen without explicit approval.**

## Reward rules as implemented (and previewed) in the app

`baseMEV = co2AvoidedGrams × 20 / 1000`; streak multiplier 1.0× (days 1–4), 1.5× (5–9), 2.0× (10–19), 3.0× (20+);
`reward = baseMEV × multiplier + bonus` where bonus is ACTIVE 15, EV_CAR / EV_2W / METRO 10, EBUS / ICE 0. 18-decimal integer
maths in `src/lib/carbon/rewardPreview.ts`; a test runs it against the compiled contract for every mode, several gram values and
streak steps and requires exact equality.
