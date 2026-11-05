# Security policy

MissionEV is a hackathon prototype running on a **testnet**. $MEV is a prototype reward token, not a certified carbon credit and
not a store of value. Even so, please report problems responsibly.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** button on the repository's Security tab if it is shown. Otherwise open an issue that says
only "security report, please contact me" (no exploit details) or message [@ManavNegi2807](https://github.com/ManavNegi2807).

## What is in scope

* The oracle service (`src/server/`, `src/app/api/sign-trip`): anything that makes it sign a value it did not derive itself, or sign a simulated trip while `DEMO_SIGNING` is off.
* The contract in `contracts/proposed/MissionEVv2.sol`, deployed at `0x0904244017324dc1bf7c611fe1236936ee65fc82` on Portal V3 testnet.
* Any path that could put a private key or API key in the browser bundle, a log or a commit.

## Known limitations (documented, not new findings)

These are written down in [`docs/CONTRACT_AUDIT.md`](docs/CONTRACT_AUDIT.md) and [`docs/INTEGRATION_REPORT.md`](docs/INTEGRATION_REPORT.md):

* One oracle key signs rewards, and the contract owner can replace it with an owner-only function. There is no pause, supply cap or ownership transfer.
* The oracle's per-commuter daily limit and duplicate memory are held in process memory, so they reset on restart and are per instance.
* Sign-in is a wallet connection, not yet a signed login message, and the server issues no session. What matters on-chain does not rely on it: the verifier node re-checks a fresh wallet signature on every reward request. A demo account has no wallet and is never on-chain.
* GPS evidence comes from the commuter's own browser and can be spoofed; the oracle checks plausibility, not truth.

## Demo signing (`DEMO_SIGNING`): a deliberate, flag-gated risk

The oracle normally refuses simulated trips. With the server flag `DEMO_SIGNING=true` it signs a clearly labelled *synthetic* trip so a
real testnet transaction can be shown without driving. This is the one place MissionEV signs something that is not real travel, so it is
written down here rather than hidden.

**Risk.** Anyone with a wallet who can reach the server can mint $MEV for a trip that never happened, up to the caps. On a testnet token
with no value that is acceptable for a demo; it would not be for anything that carries value or counts as impact.

**Mitigations.**

* Off by default; the hosted site keeps it off. Use a *separate* demo deployment with a *fresh oracle key whose address is the contract's
  oracle signer for that deployment only*, never the main site's key. The owner can replace the oracle signer on the contract at any time.
* Requires a real wallet and the same fresh (under 5 minutes) wallet proof as any trip: the no-wallet demo account can never reach the chain.
* The oracle still recomputes distance and CO2 from the samples, needs at least 1 km, and applies the unchanged reward policy (petrol,
  diesel, CNG and zero-saving trips are never signed). It never signs a client-supplied figure.
* The usual per-IP limit and daily cap apply, plus a per-wallet demo cap (`DEMO_MAX_TRIPS_PER_WALLET`, default 3 a UTC day).
* The trip id is derived from a `missionev-demo:` prefix, so demo trips are distinguishable off-chain, and the contract's
  `processedTrips` and nonce still stop replays.
* The response, the signed object and the oracle's log carry `demo: true`; the app labels every such trip as not real travel and shows a
  distinct **DEMO · ON-CHAIN** badge.
* `NEXT_PUBLIC_DEMO_SIGNING` only shows the button. The server flag decides, so flipping the public one in a browser signs nothing.

**What these do not do.** The caps are in process memory (a restart or another serverless instance resets them), and nothing stops
many wallets from each taking their share. The contract cannot tell a demo trip from a real one, so on-chain counts must not be read as
real travel on a deployment that has this flag on. Report anything that bypasses the checks above, or that makes the flag-off server sign
a simulated trip, as a vulnerability.

## Dependency advisories

`npm audit --omit=dev` reports **no** vulnerabilities in anything that runs in production. `npm audit` on 4 November 2026 reports 18 in
development tooling only (the ESLint plugin chain and `minimatch`, the `solc` compiler and its `tmp` dependency); none of it ships to
users or runs on the server. They are left alone on purpose: the suggested fix is a breaking upgrade, and the tooling is not exposed to
untrusted input here.

## Secrets

* `.env*` files are git-ignored (only `.env.example`, which holds no values, is committed). `ORACLE_PRIVATE_KEY` and the other server
  settings must never carry a `NEXT_PUBLIC_` prefix.
* If a key ever appears in a chat, a commit, a screenshot or a log, treat it as compromised and replace it. The deployment scripts read
  keys from the environment and never print them.
