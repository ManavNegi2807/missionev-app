# Submission checklist: Portaldot Hacker House 2026

Status as of 3 November 2026. The organisers' timeline lists the final deliverables as: **GitHub repo, testnet contracts, demo link and
pitch deck**, with the code freeze on **6 November 2026** (confirm the exact cut-off time on DoraHacks), live demos on 7 to 8 November and
the community vote on 9 November.

| Requirement | Status | Where / what is missing |
|---|---|---|
| Public GitHub repository | Done | https://github.com/ManavNegi2807/missionev-app |
| Real development history, at least 3 commits | Done | `git log`: commits from 30 October to 3 November 2026, none back-dated |
| README with deployment instructions | Done | [`README.md`](../README.md), [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| Project docs | Done | [`ARCHITECTURE.md`](ARCHITECTURE.md), [`FRONTEND.md`](FRONTEND.md), [`BACKEND.md`](BACKEND.md), [`SMART_CONTRACT.md`](SMART_CONTRACT.md), [`FLOW.md`](FLOW.md), [`CONTRACT_AUDIT.md`](CONTRACT_AUDIT.md), [`INTEGRATION_REPORT.md`](INTEGRATION_REPORT.md) |
| Product architecture diagram | Done | Mermaid diagrams in [`ARCHITECTURE.md`](ARCHITECTURE.md) and the README |
| Runnable code | Done | `npm ci && npm run dev`; CI runs lint, type-check, 104 tests and the build |
| Testnet contract: address, transaction, verification | Done | `0x0904244017324dc1bf7c611fe1236936ee65fc82`, tx `0x11562d9b34bc9236413a1d49a7712179d8f50defdc610b3c81c6dbf01d9ca965`, `npm run contract:verify` |
| Explorer link for the contract | **Missing** | Add the official Portal V3 explorer URL to the README and [`DEPLOYMENT.md`](DEPLOYMENT.md); the indexer record is the proof link until then |
| A real `recordCommute` transaction on the contract | **Missing** | Needs the server with the oracle key and a wallet on Portal V3; this is the strongest proof of functionality |
| Hosted demo link | **Missing** (decision pending) | The timeline asks for a demo link. The app currently runs locally; a public URL needs hosting (see [`DEPLOYMENT.md`](DEPLOYMENT.md)) |
| Demo video, 3 minutes at most | **Missing** | Script in [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) |
| Pitch deck | **Missing** | Outline in [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) |
| Third-party code and data disclosed | Done | [`THIRD_PARTY.md`](../THIRD_PARTY.md), disclosure section of the README |
| Team members and roles | **Needs the team** | Add names to the README's Team section |
| No secrets in the repository | Done | `.env*` ignored; every tracked file is scanned for the real key values before each push; `.env.example` has no values |
| Honest labelling of simulated parts | Done | DEMO labels throughout; real-versus-simulated table in [`INTEGRATION_REPORT.md`](INTEGRATION_REPORT.md) |

## Judging criteria and where the evidence is

| Criterion (weight) | Evidence |
|---|---|
| Technical feasibility (30%) | A verified deployment on Portal V3; an oracle that recomputes everything before signing; 104 tests that run the compiled contract; an audit with findings demonstrated by execution; CI |
| Innovation, use of Portaldot V3 EVM (30%) | Journey-based rewards ("reward the impact, not the ownership"); EIP-712 oracle pattern with commuter-submitted transactions on Portal V3; on-chain streaks and score |
| Ecosystem contribution (20%) | Reusable deploy and verify tooling for Portal V3 (stale-RPC guard, constructor simulation, immutable-aware code check); notes on fees, the Remix error and RPC lag in [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| Business potential (20%) | A measurable, sourced carbon method that a transit operator or employer could pay for; the roadmap in the README |

## After the code freeze

Fix only serious bugs, and write each one down (what broke, what changed, the commit) in this file.
