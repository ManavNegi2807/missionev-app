# Security policy

MissionEV is a hackathon prototype running on a **testnet**. $MEV is a prototype reward token, not a certified carbon credit and
not a store of value. Even so, please report problems responsibly.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** button on the repository's Security tab if it is shown. Otherwise open an issue that says
only "security report, please contact me" (no exploit details) or message [@ManavNegi2807](https://github.com/ManavNegi2807).

## What is in scope

* The oracle service (`src/server/`, `src/app/api/sign-trip`): anything that makes it sign a value it did not derive itself.
* The contract in `contracts/proposed/MissionEVv2.sol`, deployed at `0x0904244017324dc1bf7c611fe1236936ee65fc82` on Portal V3 testnet.
* Any path that could put a private key or API key in the browser bundle, a log or a commit.

## Known limitations (documented, not new findings)

These are written down in [`docs/CONTRACT_AUDIT.md`](docs/CONTRACT_AUDIT.md) and [`docs/INTEGRATION_REPORT.md`](docs/INTEGRATION_REPORT.md):

* One oracle key signs rewards, and the contract owner can replace it with an owner-only function. There is no pause, supply cap or ownership transfer.
* The oracle's per-commuter daily limit and duplicate memory are held in process memory, so they reset on restart and are per instance.
* Sign-in is a wallet connection, not yet a signed login message, and the server issues no session. What matters on-chain does not rely on it: the verifier node re-checks a fresh wallet signature on every reward request. A demo account has no wallet and is never on-chain.
* GPS evidence comes from the commuter's own browser and can be spoofed; the oracle checks plausibility, not truth.

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
