# Contributing

Thanks for looking at MissionEV. It is a hackathon prototype, but changes are welcome.

## Set up

```bash
git clone https://github.com/ManavNegi2807/missionev-app.git
cd missionev-app
npm ci
npm run dev        # http://localhost:3000, DEMO mode, no keys needed
```

Needs Node 20.9 or newer (Next.js 16). Read `AGENTS.md` and `node_modules/next/dist/docs/` before changing framework-level code: this
Next.js version differs from older ones.

## Before you open a pull request

```bash
npm run lint
npm run typecheck  # next typegen, then tsc --noEmit
npm test           # the full suite, including the compiled contract run in an in-process EVM
npm run build
```

CI runs the same four commands on every push and pull request.

## Ground rules

* **Never commit a secret.** No `.env.local`, keys, mnemonics or real phone numbers. Keep secrets out of any `NEXT_PUBLIC_` variable.
* **Label what is simulated.** A DEMO result must never be shown as an on-chain transaction. $MEV is not a certified carbon credit.
* **Carbon numbers need a source.** New factors go in `src/lib/carbon/emissionFactors.ts` with value, unit, year, source and a status
  (`primary`, `secondary` or `assumption`).
* **Contract changes.** `contracts/MissionEV.sol` is kept exactly as supplied. Fixes go in `contracts/proposed/` with tests in
  `tests/contract.test.ts`; a deployed contract cannot be edited, so a change means a new address.
* Keep commits small, with a message that says why.
