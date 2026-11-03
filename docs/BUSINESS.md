# Business case

MissionEV is a prototype, so this page separates what is built from what is a hypothesis to test. Nothing here is a market-size claim.

## The problem

Transport emissions come from millions of individual journeys, but schemes that try to change behaviour mostly reward **owning** a clean
vehicle (a subsidy, a toll discount), not **using** clean transport. A commuter who takes the metro every day gets nothing, and an EV owner
who takes a petrol cab for a day is treated as clean. There is also no cheap, verifiable record of what a journey actually saved, which is
what an employer, a city or a sponsor would need before paying for behaviour change.

## What MissionEV does about it (built)

* Measures each journey, compares it with a stated reference journey on one accounting boundary, and shows the formula, sources and confidence.
* Rewards only what an oracle could verify, in a token ($MEV) whose rules are public and enforced by a contract on Portal V3.
* Keeps the commuter in control: their own wallet sends the transaction, and nothing about the journey needs a custodian.
* Runs today as a working prototype with a verified testnet contract, 100+ tests and CI.

## Who it is for

| User | What they get | Who pays (hypothesis) |
|---|---|---|
| Commuters | A reward and a visible record for choosing metro, bus, cycling, walking or an EV, whatever they own | Nobody: free to use |
| Employers and campuses running a green-commute programme | A verifiable, privacy-light measure of commute emissions and a way to reward staff | The employer, per active commuter or per verified journey |
| Transit operators and city programmes | Evidence of mode shift on a corridor, and a reward channel that points riders to their service | The operator or programme, from an existing sustainability budget |
| Brands and sponsors | A reward pool tied to a measurable outcome instead of an impression | The sponsor, funding the reward pool |

## Revenue paths to test

None of these is proven. They are the order in which we would test them.

1. **Programme fee** from employers or campuses: a monthly fee per active commuter, with an emissions report included.
2. **Funded reward pools**: a sponsor or operator funds rewards for a corridor or a campaign, and the product takes a service fee.
3. **Verified-journey data and reporting** for operators and city programmes, sold as a dashboard with the method attached.

## Path to first users

1. A pilot on one corridor or one employer campus in the Delhi NCR, where the grid factor and transit modes are already modelled.
2. Replace the demo sign-in with real phone verification and the in-memory oracle limits with a database (the two things that block a public pilot).
3. Replace the placeholder metro and e-bus factors with operator figures, and add cited efficiency data for popular vehicles.
4. Measure: weekly active commuters, verified journeys per week, change in clean-mode share against a baseline, and cost per kg of CO2e avoided.

## Honest risks

| Risk | What exists today | What is still needed |
|---|---|---|
| Location data can be faked | The verifier node recomputes distance from the samples, checks plausibility, and never signs simulated trips | Device attestation, per-device limits and anti-sybil rules before real money is at stake |
| $MEV could be mistaken for a carbon credit | Every screen and doc says it is a prototype reward token, not a certified credit | Keep it positioned as an engagement reward unless it is certified under a recognised standard |
| Emission factors are only as good as their sources | Every factor carries its source, year and confidence; the grid factor is the CEA's published figure | Operator data for metro and e-bus, and a review of the fuel factors |
| One oracle key signs rewards | The verifier node signs only what it derived, and the owner can rotate the signer | A multi-signer or threshold design, and a pause control, before holding real value |
| Regulation of tokens | The token has no redemption and no market | Legal review before any redemption or trading is offered |
| Cost of a transaction | One `recordCommute` was estimated at about 35 tPOT on the testnet at the gas price seen on 4 November, and the commuter's wallet pays it | A relayer or sponsored-gas design, batching several journeys into one transaction, or the ecosystem programme's gas-fee rebates, before real users are asked to pay |

## Why Portal V3

Portal V3's EVM compatibility is what makes the rest practical: standard typed-data signatures, a standard token and standard wallets all
work, so a commuter needs no new software, and an employer can inspect every reward on a public ledger. The ecosystem support programme
(technical review, mainnet migration help, gas incentives) is a realistic way to get from this prototype to a pilot.

## The team

Manav Negi built the stack in this repository: the carbon engine, the verifier node, the contract integration, the tests and CI, and the
deployment and verification tooling. Add teammates, their roles and anything that shows they can keep operating the product.
