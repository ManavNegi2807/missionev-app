# Deployment

## Testnet deployment record

| | |
|---|---|
| Contract | `MissionEVv2` ([source](../contracts/proposed/MissionEVv2.sol)) |
| Network | Portal V3 testnet, chain id `420420777` |
| EVM RPC | `https://test-evm-rpc-v3.portaldot.dev` |
| Address | `0x0904244017324dc1bf7c611fe1236936ee65fc82` |
| Transaction | `0x11562d9b34bc9236413a1d49a7712179d8f50defdc610b3c81c6dbf01d9ca965` |
| Block / time | 309126, 2026-11-03 17:41 UTC |
| Deployer / owner | `0x184Ef822438f5D64C9dD41F570af794b347CE84e` |
| Oracle signer | `0x2aD67FaC8dB8fF3255bA650639049020420160De` |
| Cost | about 418 tPOT paid (the pre-flight estimate was 424.8 tPOT; the deployer held 450) |
| Proof | [indexer record](https://portalindex-98f0.onrender.com/evm_transactions?tx_hash=eq.0x11562d9b34bc9236413a1d49a7712179d8f50defdc610b3c81c6dbf01d9ca965) · [`contracts/deployments/420420777-MissionEVv2.json`](../contracts/deployments/420420777-MissionEVv2.json) |

The owner and oracle are two different, freshly generated keys. Neither key is in the repository.

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
| `ORACLE_PRIVATE_KEY` | **server only, never `NEXT_PUBLIC_`** | the key whose address is the contract's `azureOracleSigner` |
| `NEXT_PUBLIC_MEV_CONTRACT_ADDRESS`, `NEXT_PUBLIC_PORTAL_RPC_URL` | public | the same address and URL, so the browser can offer to add the network |
| `AZURE_VISION_ENDPOINT`, `AZURE_VISION_KEY` | server only, optional | receipt OCR |
| `ORACLE_SIGNATURE_TTL_SECONDS`, `ORACLE_MAX_TRIPS_PER_DAY` | server only, optional | tuning |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `NEXT_PUBLIC_AZURE_MAPS_KEY` | public, optional | map keys; restrict them by domain |

`.env.example` lists every name with no values. Then open `/api/status`: it shows `LIVE` once all three server settings are present, and
never prints a secret. A LIVE journey also needs real GPS and a real wallet on chain 420420777 holding a little tPOT for gas.

To try the whole LIVE flow without touching a network, `npm run dev:chain` starts a local in-memory EVM with the real contract and prints
the settings to use.

## Hosting

Any Node host for Next.js works (for example Vercel). Two things to know: the oracle's rate limit and duplicate memory are in process
memory, so on a serverless host each instance has its own (the on-chain `processedTrips` flag still prevents double minting); and the
OTP is a mock, so a public site is a demo, not a production sign-in.

## Notes for other builders on Portal V3

Observed while deploying this contract (3 November 2026):

* **Fees are weight-based and creation is expensive.** A 3,933-byte creation by another project (block 97421) paid about 322 tPOT; this
  contract's 5,610-byte creation paid about 418 tPOT. Treat the node's estimate as the minimum the deployer should hold (the script
  refuses to send below it), and fund the deployer with the estimate plus a margin, in one wallet.
* **Remix showed `_context7.t3.error.indexOf is not a function`** against this node. A Portal developer said in the Portaldot Discord that
  this is a receipt-format mismatch that can appear even when a deployment succeeds. In our case nothing had been deployed (the wallet's
  transaction count stayed 0), so do not trust either reading: check the chain (`eth_getCode`, the wallet's nonce, the indexer) before and after.
* **The public RPC can fall behind.** We saw it frozen on 31 October and 1 November (last block 265334, 11:01 UTC on 1 November) and healthy
  again by 3 November. A node that is not following the chain reports stale balances and nonces, so the deploy script refuses to send when
  the newest block is more than five minutes old.
* **Node error codes seen by others:** `1010 invalid transaction` and `1012 transaction is temporarily banned`. Our reading, not documented
  by Portal: 1010 is a transaction the pool rejects (for example a fee the wallet cannot cover), and 1012 means that exact transaction was
  rejected recently, so resending it unchanged does not help.
* A community indexer (`/evm_transactions`, shared in the Portaldot Discord) is a convenient second opinion: a deployment shows up with a
  null `to_addr`.
