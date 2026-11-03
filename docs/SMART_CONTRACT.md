# Smart contract: MissionEVv2

| | |
|---|---|
| Network | Portal V3 testnet, chain id `420420777` |
| Address | `0x0904244017324dc1bf7c611fe1236936ee65fc82` |
| Deploy transaction | `0x11562d9b34bc9236413a1d49a7712179d8f50defdc610b3c81c6dbf01d9ca965` (block 309126) |
| Source | [`contracts/proposed/MissionEVv2.sol`](../contracts/proposed/MissionEVv2.sol), Solidity `^0.8.24`, compiled with solc 0.8.34, optimizer 200 runs, EVM `paris` |
| Compiled artifact | [`contracts/artifacts/MissionEVv2.proposed.json`](../contracts/artifacts/MissionEVv2.proposed.json) |
| Deploy record | [`contracts/deployments/420420777-MissionEVv2.json`](../contracts/deployments/420420777-MissionEVv2.json) |
| Owner / oracle | `0x184Ef822438f5D64C9dD41F570af794b347CE84e` / `0x2aD67FaC8dB8fF3255bA650639049020420160De` |

Token: **MissionEV Carbon Reward** (`MEV`, 18 decimals), a prototype reward token. It is **not a certified carbon credit**, and it is a
different thing from the native tPOT used for gas.

## Functions

| Function | Caller | What it does |
|---|---|---|
| `constructor(address oracle)` | deployer | Sets `owner` to the deployer and `azureOracleSigner` to `oracle` (must not be zero), and computes the EIP-712 `DOMAIN_SEPARATOR` for this chain and address |
| `recordCommute(tripId, mode, distanceMeters, co2AvoidedGrams, deadline, sig)` | the commuter (`msg.sender`) | Checks the deadline, that the trip is new, and that `sig` is 65 bytes; verifies the oracle's EIP-712 signature; then records the trip, updates streak and score, and mints the reward to the caller |
| `setAzureOracle(newOracle)` | owner | Replaces the signer (not zero); emits `OracleUpdated` |
| `getCommuter(address)` | anyone (view) | Score, streak days, last trip time, total avoided grams, trips logged, token balance |
| `balanceOf`, `totalSupply`, `transfer`, `transferFrom`, `approve`, `allowance` | | A complete ERC-20 surface, with zero-address checks |
| `nonces(address)`, `processedTrips(bytes32)`, `commuters(address)` | anyone (view) | Replay protection and profile state |
| `DOMAIN_SEPARATOR`, `TRIP_TYPEHASH` | anyone (view) | EIP-712 constants |

Events: `Transfer`, `Approval`, `CommuteVerified(commuter, tripId, mode, distanceMeters, co2AvoidedGrams, pointsMinted, newCarbonScore)`,
`StreakUpdated`, `OracleUpdated`.

## Signed payload (EIP-712)

Domain: `name "MissionEV"`, `version "1"`, `chainId` (`block.chainid`), `verifyingContract` (the contract address).

```
TripPayload(address commuter, bytes32 tripId, uint8 mode, uint32 distanceMeters,
            uint32 co2AvoidedGrams, uint256 nonce, uint256 deadline)
```

The commuter is `msg.sender` and the nonce is read from the contract, so a signature cannot be used by anyone else or twice. The app
builds the same typed data in `src/lib/oracle/typedData.ts`, and the tests check it against the compiled contract's own
`DOMAIN_SEPARATOR` and `TRIP_TYPEHASH`.

## Transport modes (never reordered)

| 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| EV_CAR | EV_2W | METRO | EBUS | ACTIVE | ICE_CAR | ICE_SUV |

The oracle only signs the clean modes; petrol, diesel and CNG journeys are measured and shown but never signed. The contract itself
does not enforce that, which is why the oracle's reward policy matters.

## Reward arithmetic

```
base   = co2AvoidedGrams × 20 MEV / 1000                    (20 MEV per kg avoided)
reward = base × streakMultiplier + modeBonus
streakMultiplier: 1× (days 1-4), 1.5× (5-9), 2× (10-19), 3× (20+)
modeBonus (only if co2AvoidedGrams > 0): ACTIVE +15 MEV; EV_CAR, EV_2W, METRO +10 MEV; others 0
score: starts at 500; +8 if more than 2000 g, +4 if more than 500 g, else +2; capped at 1000
streak: counts consecutive UTC calendar days (block.timestamp / 1 days)
```

## What changed from the supplied v1

`contracts/MissionEV.sol` is kept verbatim. v2 keeps the same `recordCommute` ABI, enum numbering and EIP-712 payload, so the oracle and
front end work unchanged. It fixes: a zero oracle accepted by the constructor (critical in v1: any garbage signature would mint), no
low-`s` check, no signature-length check, no `v` check, `transfer` to the zero address, and the missing `transferFrom`. It also stops
paying the mode bonus when 0 g was avoided (a behaviour change). Every finding was demonstrated by running the compiled contract
([`tests/contract.test.ts`](../tests/contract.test.ts)); see [`CONTRACT_AUDIT.md`](CONTRACT_AUDIT.md).

## Trust model and limits

* One oracle key signs rewards, and the owner can replace it. There is no pause, supply cap or ownership transfer.
* The contract trusts the oracle about what happened; it cannot see the journey.
* `distanceMeters` is stored in the event but does not enter the reward.
* There is no `redeem` or `burn`, so the app's redemption screen is a labelled simulation.
* No per-day cap on-chain: the oracle limits signed journeys per commuter (default 8 a day), in memory.

## Verify the deployment yourself

```bash
PORTAL_RPC_URL=https://test-evm-rpc-v3.portaldot.dev npm run contract:verify -- \
  --address 0x0904244017324dc1bf7c611fe1236936ee65fc82 \
  --oracle 0x2aD67FaC8dB8fF3255bA650639049020420160De --owner 0x184Ef822438f5D64C9dD41F570af794b347CE84e
```

The check reads the code from the chain and compares it with the artifact (the `DOMAIN_SEPARATOR` immutable is the one place they differ,
because the chain fills it in), recomputes the domain separator, and compares the token name, oracle and owner.
