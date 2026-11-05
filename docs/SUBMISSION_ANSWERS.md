# DoraHacks submission: the answers, field by field

These are the nine fields on the Portaldot Hacker House 2026 form (read from the event page on 4 November 2026), with text you can paste.
Everything here is true today. The two things only you can fill in are marked **YOU**. Final submission and code freeze: **6 Nov 04:00 UTC**
(09:30 IST).

| Field | Required | Answer |
|---|---|---|
| Project name | yes | MissionEV |
| Track (pick one) | yes | **Ecosystem DApps** |
| One-sentence overview | yes | MissionEV is a "Strava for carbon": it measures each journey you take, has a verifier node check it, and pays $MEV on Portal V3 for the CO2 you actually avoided, in a transaction your own wallet sends. |
| Current progress (Week 2 check-in) | no | See "Progress" below. |
| Outstanding items (Week 2 check-in) | no | See "Outstanding" below. |
| GitHub repository | yes | https://github.com/ManavNegi2807/missionev-app |
| Testnet deployment details | yes | See "Deployment details" below. |
| Demo video (public, under 3 minutes) | yes | **YOU:** paste the link once it is recorded. Script: [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md). |
| Pitch deck link | yes | https://github.com/ManavNegi2807/missionev-app/blob/master/docs/pitch/MissionEV-pitch-deck.pdf |

## Deployment details (paste as is)

```
Network:            Portal V3 testnet, chain id 420420777
EVM RPC:            https://test-evm-rpc-v3.portaldot.dev
Contract:           MissionEVv2  0x0904244017324dc1bf7c611fe1236936ee65fc82
Deploy transaction: 0x11562d9b34bc9236413a1d49a7712179d8f50defdc610b3c81c6dbf01d9ca965  (block 309126, 2026-11-03 17:41 UTC)
Owner / deployer:   0x184Ef822438f5D64C9dD41F570af794b347CE84e
Oracle signer:      0x2aD67FaC8dB8fF3255bA650639049020420160De
Check it yourself:  npm run contract:verify   (read-only; compares the on-chain code with the compiled artifact)
Live check:         the "Ask the chain, right now" panel at https://missionev-app.vercel.app (reads the chain, nothing is sent)
Status:             the contract is live and verified. No recordCommute transaction has been sent from the web app yet, because one
                    costs about 35 tPOT in gas and the available wallets hold less. The verifier node's signature was accepted by
                    the deployed contract in an eth_call simulation (nothing sent).
```

**YOU:** the moment a real `recordCommute` goes through, replace the last two lines with its transaction hash. The form asks for
"ideally featuring actual testnet interactions", so that single line is worth more than anything else on this page.

## Progress (Week 2 check-in field, if you want to fill it)

Smart contract deployed and verified on Portal V3 testnet. Journey-based carbon engine with sourced emission factors. Verifier node
(`/api/sign-trip`) that recomputes everything and signs an EIP-712 payload. MetaMask sign-in with network switching. Four-screen web app
and an interactive landing page, live at https://missionev-app.vercel.app. A live read-only panel that shows the chain and the contract
answering. More than 150 unit tests (including the compiled contract run in an EVM), 138 browser checks, and CI on every push.
Pitch deck and documentation in the repository.

## Outstanding (Week 2 check-in field, if you want to fill it)

A first real `recordCommute` transaction sent from the web app, which needs about 35 tPOT in one wallet. The demo video. Teammate names and
roles in the README. A durable store for the verifier node's limits (they live in memory today). Sign-In with Ethereum for a proper
server session. Sourced metro and e-bus factors to replace today's placeholders.

## Before you press submit

1. Open the repository in a private window and check it is public, the README renders, and the CI badge is green.
2. Open https://missionev-app.vercel.app in a private window and press Launch the app.
3. Open the video link in a private window and check it plays without signing in.
4. Open the deck link and check it opens.
5. Check the README's team section and the origin statement (what existed before 14 October) are true.
