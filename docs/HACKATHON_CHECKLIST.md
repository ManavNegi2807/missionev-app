# Submission checklist: Portaldot Hacker House 2026

Status as of 4 November 2026, checked against the organisers' published rules. Track: **Ecosystem DApps**.

**Key dates (UTC):** final submission and code freeze **6 Nov 04:00** (09:30 IST); live demo day 8 to 9 Nov; community voting 9 Nov 16:00 to
10 Nov 16:00; winners 11 Nov. Core modules must not all be committed in the last 24 hours before the freeze, so the rule of thumb for the
final stretch is: **nothing structural after 5 Nov 04:00 UTC**; use the remaining time for the video, the deck and small, logged fixes.

## Final submission materials

| Required | Status | Where / what is missing |
|---|---|---|
| Project name, one-sentence overview | Done | MissionEV: "A Strava for carbon" (README, first lines) |
| Team members | **Needs the team** | README, "Team and licence": add every teammate and role |
| Public GitHub repository | Done | https://github.com/ManavNegi2807/missionev-app (public) |
| Complete README | Done | [`README.md`](../README.md) |
| Deployment instructions | Done | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| Project documentation | Done | [`ARCHITECTURE.md`](ARCHITECTURE.md), [`FRONTEND.md`](FRONTEND.md), [`BACKEND.md`](BACKEND.md), [`SMART_CONTRACT.md`](SMART_CONTRACT.md), [`FLOW.md`](FLOW.md), [`BUSINESS.md`](BUSINESS.md), [`CONTRACT_AUDIT.md`](CONTRACT_AUDIT.md), [`INTEGRATION_REPORT.md`](INTEGRATION_REPORT.md) |
| Reproducible, runnable final code | Done | `npm ci && npm run dev`; CI runs lint, type-check, tests and the build on every push |
| Testnet deployment information | Done | Contract `0x0904244017324dc1bf7c611fe1236936ee65fc82`, tx `0x11562d9b34bc9236413a1d49a7712179d8f50defdc610b3c81c6dbf01d9ca965`, [explorer](https://node-console.portaldot.dev/), `npm run contract:verify` |
| Verifiable on-chain interactions | **Partly** | The deployment is verifiable. A `recordCommute` transaction from the app has **not** been sent yet: this is the biggest gap against "technical feasibility" |
| Runnable demo: web link **or clear local instructions in the README** | Done | Local instructions: README "Try it in 60 seconds". A hosted link is optional |
| Demo video, at most 3 minutes, showing a real product, the core functions and Portaldot integration, publicly accessible | **Missing** | Script and shot list in [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md); upload and paste the link |
| Pitch deck (PDF or public link): problem, why Portaldot is essential, proof it works, why continued support | **Missing** | Outline in [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) |
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

## After the code freeze

Fix only serious bugs, tell the organisers, and write each one down here (what broke, what changed, the commit).
