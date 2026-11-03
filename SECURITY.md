# Security policy

MissionEV is a hackathon prototype running on a **testnet**. $MEV is a prototype reward token, not a certified carbon credit and
not a store of value. Even so, please report problems responsibly.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** button on the repository's Security tab if it is shown. Otherwise open an issue that says
only "security report, please contact me" (no exploit details) or message [@ManavNegi2807](https://github.com/ManavNegi2807).

## What is in scope

* The oracle service (`src/server/`, `src/app/api/sign-trip`): anything that makes it sign a value it did not derive itself.
* The contract in `contracts/proposed/MissionEVv2.sol`, deployed at `0x0904244017324dc1bf7c611fe1236936ee65fc82` on Portal V3 testnet.
* Any path that could put a private key, API key or full phone number in the browser bundle, a log or a commit.

## Known limitations (documented, not new findings)

These are written down in [`docs/CONTRACT_AUDIT.md`](docs/CONTRACT_AUDIT.md) and [`docs/INTEGRATION_REPORT.md`](docs/INTEGRATION_REPORT.md):

* One oracle key signs rewards, and the contract owner can replace it with an owner-only function. There is no pause, supply cap or ownership transfer.
* The oracle's per-commuter daily limit and duplicate memory are held in process memory, so they reset on restart and are per instance.
* Sign-in uses a fixed demo one-time password. It is not authentication.
* GPS evidence comes from the commuter's own browser and can be spoofed; the oracle checks plausibility, not truth.

## Secrets

* `.env*` files are git-ignored (only `.env.example`, which holds no values, is committed). `ORACLE_PRIVATE_KEY` and the other server
  settings must never carry a `NEXT_PUBLIC_` prefix.
* If a key ever appears in a chat, a commit, a screenshot or a log, treat it as compromised and replace it. The deployment scripts read
  keys from the environment and never print them.
