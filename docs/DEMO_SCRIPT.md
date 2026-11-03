# Demo video script (3 minutes maximum) and pitch outline

Be explicit on camera about what is simulated. The app labels it too, and judges reward honesty over polish.

Before recording: `npm run dev`, a browser window at 1280 px wide, a wallet on Portal V3 with a little tPOT, and
`npm run contract:verify` ready in a terminal. For the LIVE part the server needs the oracle key (see
[`DEPLOYMENT.md`](DEPLOYMENT.md)); if it is not set up, skip step 5 and show step 6 instead.

| Time | Show | Say |
|---|---|---|
| 0:00-0:20 | The register screen | "Cities have no way to reward the *journey* someone chose. Existing schemes reward owning an EV. MissionEV rewards the impact of each trip: an EV owner in a petrol cab earns nothing, a metro commuter with no vehicle can earn." |
| 0:20-0:45 | Sign in (demo OTP, labelled), then the transport profile | "How do you usually commute? Ten modes. Vehicles are only a profile: efficiency comes from battery and range, or km per litre, and unknown mileage is labelled low confidence, never invented." |
| 0:45-1:25 | Capture trip: pick Metro, Simulated, start, verify | "Each trip asks how I travelled. This one is a labelled simulation. The verification engine runs four checks, then the carbon engine compares my journey with a reference journey on the same boundary." Open "How did MissionEV calculate this?": formula, CEA grid factor, year, confidence |
| 1:25-1:50 | The reward preview and the DEMO credit button | "The preview is an exact replica of the contract's arithmetic. In demo mode the credit stays in this tab: it says nothing was minted." |
| 1:50-2:30 | **LIVE:** connect the wallet on chain 420420777, real-GPS trip, request signature, send `recordCommute`, show the transaction hash and the balance read back | "The wallet signs a free proof, the oracle recomputes everything itself and signs the exact EIP-712 payload, and *my* wallet sends the transaction, so the oracle can sign but never submit." |
| 2:30-2:45 | Terminal: `npm run contract:verify` on `0x0904244017324dc1bf7c611fe1236936ee65fc82` | "The contract is live on Portal V3 testnet. This read-only check compares the on-chain code with the compiled artifact, the EIP-712 domain, the oracle and the owner." |
| 2:45-3:00 | Rewards and analytics screens | "Why Portal: an EVM chain where commuters' own wallets submit signed trips, with streaks and score on-chain. Next: a durable oracle store, real SMS sign-in, sourced metro and e-bus factors." |

Honest notes to say or show: sign-in is a demo OTP; the community analytics are synthetic; redemptions are simulated because the contract has
no `redeem`; $MEV is a prototype token, not a certified carbon credit.

## Pitch deck outline (8 slides)

1. **Title.** MissionEV, a Strava for carbon. One-line promise: reward the impact of the journey, not the vehicle.
2. **Problem.** Transport emissions are measured by fuel sold or vehicles owned, not by the trips people actually make. Incentives go to
   whoever owns the vehicle.
3. **Idea.** Measure each trip, compare it with a stated reference, reward the avoided CO2. Show the metro versus petrol-cab example.
4. **How it works.** The sequence diagram from [`ARCHITECTURE.md`](ARCHITECTURE.md): trip, oracle, wallet-submitted transaction.
5. **Why Portal V3 is essential.** EVM compatibility (EIP-712, `ecrecover`, ERC-20), commuter-submitted transactions, on-chain streaks and
   score, and an open record of every reward. Include the deployed address and transaction hash.
6. **Proof of functionality.** 104 tests (the compiled contract runs in an in-process EVM), a verified live deployment, browser checks of
   the full flow, an audit of the supplied contract with fixes in v2.
7. **Honest limits and next steps.** Mock OTP, in-memory oracle limits, placeholder metro and e-bus factors, no on-chain redeem. Roadmap: a
   durable store, real authentication, sourced factors, a redeemable partner catalogue.
8. **Why continued support.** What it unlocks for the Portal ecosystem (reusable deploy and verify tooling, a worked EIP-712 oracle
   pattern) and the path to a pilot with a transit operator.
