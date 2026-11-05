# Submission checklist: Portaldot Hacker House 2026

Status as of 4 November 2026 (after the MetaMask sign-in and the landing page were added), checked against the organisers' published rules. Track: **Ecosystem DApps**.

**Key dates (UTC):** final submission and code freeze **6 Nov 04:00** (09:30 IST); live demo day 8 to 9 Nov; community voting 9 Nov 16:00 to
10 Nov 16:00; winners 11 Nov. Core modules must not all be committed in the last 24 hours before the freeze, so the rule of thumb for the
final stretch is: **nothing structural after 5 Nov 04:00 UTC**; use the remaining time for the video, the deck and small, logged fixes.

Ready-to-paste text for every field of the submission form: [`SUBMISSION_ANSWERS.md`](SUBMISSION_ANSWERS.md).

## What the organisers say they want

Read from the event page on 4 November 2026 (84 submissions and 225 registered hackers at that moment):

* **Ecosystem DApps track:** projects driving "DeFi, RWA tokenization, and consumer-grade applications", with the goal "to generate genuine
  user demand, driving real-world Gas consumption and active user data for the ecosystem".
* **Demo video:** "ideally featuring actual testnet interactions; clearly demonstrating Portaldot use cases and prioritizing the product's
  actual performance". A real transaction on screen matters more than polish.
* **Required fields:** project name, track, one-sentence overview, GitHub repository, testnet deployment details (contract address and
  transaction hash), demo video, pitch deck link.

## Final submission materials

| Required | Status | Where / what is missing |
|---|---|---|
| Project name, one-sentence overview | Done | MissionEV: "A Strava for carbon" (README, first lines) |
| Team members | **Needs the team** | README, "Team and licence": add every teammate and role |
| Public GitHub repository | Done | https://github.com/ManavNegi2807/missionev-app (public) |
| Complete README | Done | [`README.md`](../README.md) |
| Deployment instructions | Done | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| Project documentation | Done | [`ARCHITECTURE.md`](ARCHITECTURE.md), [`FRONTEND.md`](FRONTEND.md), [`BACKEND.md`](BACKEND.md), [`SMART_CONTRACT.md`](SMART_CONTRACT.md), [`FLOW.md`](FLOW.md), [`BUSINESS.md`](BUSINESS.md), [`CONTRACT_AUDIT.md`](CONTRACT_AUDIT.md), [`INTEGRATION_REPORT.md`](INTEGRATION_REPORT.md) |
| Reproducible, runnable final code | Done | `npm ci && npm run dev`; CI runs lint, type-check, tests and the build on every push. Browser tests anyone can re-run: `npm run e2e` (see [`e2e/README.md`](../e2e/README.md)) |
| Testnet deployment information | Done | Contract `0x0904244017324dc1bf7c611fe1236936ee65fc82`, tx `0x11562d9b34bc9236413a1d49a7712179d8f50defdc610b3c81c6dbf01d9ca965`, [explorer](https://node-console.portaldot.dev/), `npm run contract:verify` |
| Verifiable on-chain interactions | **Partly** | The deployment is verifiable, and the verifier node's signature was accepted by the deployed contract in a simulation (nothing sent). A real `recordCommute` transaction has **not** been sent: it needs about 35 tPOT in one wallet, more than either remaining wallet holds. This is the biggest gap against "technical feasibility". Until then, the landing page's live "Ask the chain" panel shows the chain and the contract answering in real time |
| Runnable demo: web link **or clear local instructions in the README** | Done | Hosted: **https://missionev-app.vercel.app** (public, DEMO mode, auto-deployed from `master`; the full browser flow passes against it). Local: README "Try it in 60 seconds" |
| Demo video, at most 3 minutes, showing a real product, the core functions and Portaldot integration, publicly accessible | **Missing** | Script and shot list in [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md); upload and paste the link |
| Pitch deck (PDF or public link): problem, why Portaldot is essential, proof it works, why continued support | **Built, review it** | [`pitch/MissionEV-pitch-deck.pdf`](pitch/MissionEV-pitch-deck.pdf) (9 slides; source [`pitch/deck.html`](pitch/deck.html)). Check every claim, add your teammates, and update the "Next" tile once a real transaction exists |
| Contract address and transaction hash | Done | As above |

## Code-compliance rules

| Rule | Status | Evidence |
|---|---|---|
| Repository stays public during the event | Done | Keep it public until winners are announced |
| At least 3 valid commits in the period (14 Oct to 6 Nov) | Done | `git log`: commits from 30 Oct onwards, small and logical, none back-dated |
| Code primarily produced in the period | **Confirm** | The history starts on 30 Oct. If any part was written before 14 Oct or entered in another event, the README's disclosure section must say so |
| Core modules not all committed in the last 24 hours | Done so far | The carbon engine, verifier node, contract integration and tooling were committed 31 Oct to 3 Nov |
| Third-party code, data and services disclosed | Done | [`THIRD_PARTY.md`](../THIRD_PARTY.md) |
| Not an existing complete project | **Confirm** | See the disclosure section of the README; be exact about what existed before 14 Oct |
| Development records kept | Done | Commit history, CI runs, and the audit and integration reports |

## Judging criteria and where the evidence is

| Criterion (weight) | Evidence | Remaining gap |
|---|---|---|
| Technical feasibility (30%) | A verified deployment; a verifier node that recomputes before signing; 100+ tests running the compiled contract; CI; a clean-room check from a fresh clone | A real `recordCommute` transaction on the explorer |
| Innovation (30%) | Journey-based rewards; EIP-712 oracle with commuter-submitted transactions on Portal V3's EVM layer; an open-source stack | The project uses the EVM layer only; it does not use the WASM or cross-chain features, and the pitch should say so plainly rather than claim them |
| Ecosystem contribution (20%) | MIT licence; reusable tooling (dry-run deploy, immutable-aware verifier, `npm run network:health`); builder notes on fees, the Remix error and RPC lag | Mention the tooling in the demo video |
| Business potential (20%) | [`BUSINESS.md`](BUSINESS.md): users, who pays, revenue paths to test, path to first users, risks | Teammates and their roles; a named pilot partner if one exists |

## Before you submit

* Check on DoraHacks that your project shows as a valid submission: the final round is for **finalist teams**, and the check-in deadline
  was 24 Oct.
* Join the official Discord and keep an eye on announcements about demo-day slots.
* Testnet tokens are distributed to a **native POT address (SS58, starting with 5)**, not a `0x` address. If you still need tokens, open a
  support ticket with a screenshot of your registration, or DM the admins named on the event page. Never share a seed phrase or private key.

## Change log close to the freeze: 5 November 2026

Made on **5 Nov 2026**, one day before the freeze (6 Nov 04:00 UTC) and therefore after the "nothing structural after 5 Nov 04:00 UTC"
rule of thumb above. It is recorded here instead of being tucked away. The structural risk is contained: the new signing path is **off by
default and off on the hosted site**, so what was submitted behaves as before unless the owner turns it on in a separate deployment.

**What changed, and why.** Real on-chain transactions needed a real-GPS trip captured while moving, so the demo video and judge review had
no way to show one. The organisers value real testnet interactions.

| Commit | Change |
|---|---|
| `68f6c3f` feat(oracle) | `DEMO_SIGNING` (server, default off): the oracle may sign a *simulated* trip only for a real wallet that passes the fresh proof check, after recomputing distance and CO2, for at least 1 km, under the unchanged reward policy, the usual limits and a per-wallet demo cap. `missionev-demo:` trip-id prefix; `demo: true` in the response. Tests for flag off, flag on, under 1 km, petrol/diesel/CNG, no wallet, caps |
| `c32b652` feat(landing) | Read-only "Recent on-chain activity" panel and `GET /api/activity` (event logs via viem; handles RPC failure, an empty chain, range caps) |
| `d01b819` feat(trip) | "Demo run (1 km+)" card, self-stopping and self-verifying synthetic trip on the existing x40 clock, persistent TESTNET DEMO TRIP banner, distinct DEMO · ON-CHAIN history badge |
| `861745c` fix(copy) | Hero badge now says "Contract live on Portal V3 testnet" (the app itself is in DEMO); nine journey modes everywhere (the engine calculates nine; the profile adds an "other" that cannot be calculated); `missionev-app.vercel.app` replaces `missionev.vercel.app` throughout |

The contract, the deployment record and the chain constants are untouched; the real-GPS path, reward policy, wallet-proof check and replay
protection are not weakened. No dependency was added.

**How it was checked.** `npm run lint`, `npm run typecheck`, `npm test` (the new oracle tests run the compiled contract) and
`npm run build`; `e2e/demo-run.mjs` drives the whole Demo run in a real browser against the local in-memory chain with the real contract
and a mock wallet. **Not tested:** the MetaMask extension, and Portal V3 itself. No real `recordCommute` transaction exists yet.

## After the code freeze

Fix only serious bugs, tell the organisers, and write each one down here (what broke, what changed, the commit).
