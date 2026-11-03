# Deployment

## Testnet deployment record

| | |
|---|---|
| Contract | `MissionEVv2` ([source](../contracts/proposed/MissionEVv2.sol)) |
| Network | Portal V3 testnet, chain id `420420777` |
| EVM RPC | `https://test-evm-rpc-v3.portaldot.dev` |
| Native node | `wss://test-node-v3.portaldot.dev` |
| Explorer | [Portaldot node console](https://node-console.portaldot.dev/) |
| Address | `0x0904244017324dc1bf7c611fe1236936ee65fc82` |
| Transaction | `0x11562d9b34bc9236413a1d49a7712179d8f50defdc610b3c81c6dbf01d9ca965` |
| Block / time | 309126, 2026-11-03 17:41 UTC |
| Deployer / owner | `0x184Ef822438f5D64C9dD41F570af794b347CE84e` |
| Oracle signer | `0x2aD67FaC8dB8fF3255bA650639049020420160De` |
| Cost | about 418 tPOT paid (the pre-flight estimate was 424.8 tPOT; the deployer held 450) |
| Proof | [indexer record](https://portalindex-98f0.onrender.com/evm_transactions?tx_hash=eq.0x11562d9b34bc9236413a1d49a7712179d8f50defdc610b3c81c6dbf01d9ca965) · [`contracts/deployments/420420777-MissionEVv2.json`](../contracts/deployments/420420777-MissionEVv2.json) |

The owner and oracle are two different, freshly generated keys. Neither key is in the repository.

## Check the network first

```bash
npm run network:health
```

Read-only. It asks the EVM endpoint and the native node (over WebSocket, plain JSON-RPC, no client library) for their newest blocks and
compares them: chain id, how old the EVM head is, how far the EVM endpoint trails the native node, finality lag, peers and sync state. The
exit code is 0 when healthy, 1 when degraded and 2 when unhealthy, so a script can refuse to deploy or send. The rules live in
[`scripts/health-core.mjs`](../scripts/health-core.mjs) and are unit-tested, including the frozen-endpoint case below.

## How it was deployed

`scripts/deploy-contract.mjs` is a dry run unless `--confirm` is passed. It refuses a plain-http RPC, a wrong chain id, a zero oracle, an RPC
whose newest block is more than five minutes old, and a deployer that cannot afford the estimate. It simulates the constructor with
`eth_call`, prints the node's real error on failure, and after a successful deploy reads back the code, owner, oracle and domain separator
before it reports success and writes the deploy record.

```powershell
$env:PORTAL_RPC_URL = "https://test-evm-rpc-v3.portaldot.dev"
$env:ORACLE_ADDRESS = "0x<public address of the oracle key>"
$env:DEPLOYER_PRIVATE_KEY = "0x<deployer key>"      # type it yourself; never paste a key in chat or commit it
node scripts/deploy-contract.mjs --artifact MissionEVv2.proposed             # dry run: sends nothing
node scripts/deploy-contract.mjs --artifact MissionEVv2.proposed --confirm   # the real deployment
Remove-Item Env:DEPLOYER_PRIVATE_KEY
```

With only `DEPLOYER_ADDRESS` set (no key) the dry run is a key-less preview.

## Verify a deployment

```bash
PORTAL_RPC_URL=https://test-evm-rpc-v3.portaldot.dev npm run contract:verify -- \
  --address 0x0904244017324dc1bf7c611fe1236936ee65fc82 \
  --oracle 0x2aD67FaC8dB8fF3255bA650639049020420160De --owner 0x184Ef822438f5D64C9dD41F570af794b347CE84e
```

Read-only. It checks the code against the compiled artifact (apart from the `DOMAIN_SEPARATOR` immutable), the EIP-712 domain separator,
the token name, and the oracle and owner. Pointed at a contract that is not MissionEV it reports a clean FAIL.

## Run the app

**DEMO (no keys):**

```bash
npm ci
npm run dev        # http://localhost:3000
```

**LIVE:** the server needs three settings, read from its environment (use `.env.local`, which is git-ignored, or your host's secret store):

| Variable | Scope | Value |
|---|---|---|
| `MISSIONEV_CONTRACT_ADDRESS` | server | `0x0904244017324dc1bf7c611fe1236936ee65fc82` |
| `PORTAL_RPC_URL` | server | `https://test-evm-rpc-v3.portaldot.dev` |
| `ORACLE_PRIVATE_KEY` | **server only, never `NEXT_PUBLIC_`** | the key whose address is the contract's oracle signer (`0x2aD67FaC8dB8fF3255bA650639049020420160De`) |
| `NEXT_PUBLIC_MEV_CONTRACT_ADDRESS`, `NEXT_PUBLIC_PORTAL_RPC_URL` | public | the same address and URL, so the browser can offer to add the network |
| `ORACLE_SIGNATURE_TTL_SECONDS`, `ORACLE_MAX_TRIPS_PER_DAY` | server only, optional | tuning |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | public, optional | overrides the default Leaflet and OpenStreetMap map; restrict the key by domain |

`.env.example` lists every name (the public values of this deployment are filled in; every secret is blank). Then open `/api/status`: it shows `LIVE` once all three server settings are present, and
never prints a secret. A LIVE journey also needs real GPS and a real wallet on chain 420420777 holding a little tPOT for gas.

To try the whole LIVE flow without touching a network, `npm run dev:chain` starts a local in-memory EVM with the real contract and prints
the settings to use.

## Hosting

The public demo is **https://missionev.vercel.app**. It is a Vercel project connected to this repository: every push to `master` builds and
deploys to production. It runs in **DEMO mode** with **no environment variables**, so no key of any kind is on the host; `/api/status` on
the live site reports `"mode":"DEMO"`. Vercel's deployment protection leaves the short production address public, while the long
per-deployment addresses stay behind a Vercel login, so always share the short one.

To turn the hosted site LIVE you would add `MISSIONEV_CONTRACT_ADDRESS`, `PORTAL_RPC_URL` and `ORACLE_PRIVATE_KEY` as **server-only**
environment variables in the Vercel dashboard (typed there by you, never in chat or in a commit). Think about it first: a public site that
holds a signing key lets anyone ask it to sign, so the daily limit and the wallet-proof check become the only guards, and the rate limit is
per serverless instance.

Any Node host for Next.js works (for example Vercel). Two things to know: the oracle's rate limit and duplicate memory are in process
memory, so on a serverless host each instance has its own (the on-chain `processedTrips` flag still prevents double minting); and the
sign-in is a wallet connection with no server session, so a public site is a demo, not a production login.

## Notes for other builders on Portal V3

Observed while deploying this contract (3 November 2026):

* **Fees are weight-based and creation is expensive.** A 3,933-byte creation by another project (block 97421) paid about 322 tPOT; this
  contract's 5,610-byte creation paid about 418 tPOT. Treat the node's estimate as the minimum the deployer should hold (the script
  refuses to send below it), and fund the deployer with the estimate plus a margin, in one wallet.
* **Calls are expensive too.** On 4 November a single `recordCommute` was estimated at about 35 tPOT (about 1.5 quadrillion gas units at
  23,035 wei per unit). Budget testnet tokens per transaction, not per project, and see [`BUSINESS.md`](BUSINESS.md) for what that means for users.
* **Remix showed `_context7.t3.error.indexOf is not a function`** against this node. A Portal developer said in the Portaldot Discord that
  this is a receipt-format mismatch that can appear even when a deployment succeeds. In our case nothing had been deployed (the wallet's
  transaction count stayed 0), so do not trust either reading: check the chain (`eth_getCode`, the wallet's nonce, the indexer) before and after.
* **The public RPC can fall behind.** We saw it frozen on 31 October and 1 November (last block 265334, 11:01 UTC on 1 November) and healthy
  again by 3 November. A node that is not following the chain reports stale balances and nonces, so the deploy script refuses to send when
  the newest block is more than five minutes old, and `npm run network:health` compares the EVM endpoint with the native node to catch
  exactly this.
* **Node error codes seen by others:** `1010 invalid transaction` and `1012 transaction is temporarily banned`. Our reading, not documented
  by Portal: 1010 is a transaction the pool rejects (for example a fee the wallet cannot cover), and 1012 means that exact transaction was
  rejected recently, so resending it unchanged does not help.
* A community indexer (`/evm_transactions`, shared in the Portaldot Discord) is a convenient second opinion: a deployment shows up with a
  null `to_addr`.
