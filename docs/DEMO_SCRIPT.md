# Demo video script (3 minutes maximum) and pitch outline

The organisers ask for a public video under 3 minutes that shows the real product and Portaldot use, "ideally featuring actual testnet interactions". This script is about 315 spoken words. With short pauses it runs 2 min 22 s at a brisk pace and 2 min 59 s at a slow one; a calm 120 to 130 words a minute lands between 2 min 32 s and 2 min 45 s. Read it once, then say it in your own words. Short sentences beat perfect ones.

**Be honest on camera.** Say "simulation" when it is one. Do not say anything was minted: nothing has been yet. The app labels every simulated result, and judges reward honesty over polish.

## Before you record (10 minutes)

1. Use a throwaway MetaMask account with no funds. Never show a seed phrase or a private key. The pop-ups only show the address.
2. In MetaMask, remove the Portal V3 network if you added it before (Settings, Networks), so the video can show it being added.
3. Close other tabs and notifications. Browser window about 1280 to 1440 px wide, zoom 100 to 110%, light theme.
4. Open https://missionev-app.vercel.app in a new private window. In a second window, have a terminal in the project folder ready to run npm run contract:verify.
5. Record screen and voice together: Win + G (Xbox Game Bar) or OBS Studio (free). A quiet room and earphones with a mic are enough.
6. Do one dry run with a timer.

## Deliver it like a presenter

1. Open slowly and smile. People decide in the first ten seconds, so say the first sentence at half speed.
2. At every (pause), stay silent and count "one, two" in your head. Silence sounds confident.
3. Lean on the bold words (own, journey, reward, real): slow down a little and lower your voice. Do not shout.
4. Slow down for numbers (273, 441, 167). Say each one once, clearly.
5. Talk to the viewer, not to the screen. Let the mouse lead the eye while your voice leads the story.
6. Say the status in part 5 calmly, with no apology. Owning the gap earns trust.
7. If you stumble, pause and say the sentence again. You can cut it when you edit.
8. Record two or three takes and keep the best. End on the last line with a smile.

## The script

Each part has what to do on screen, then what to say. **Bold** words get a little weight. *(pause)* means stay silent for a beat; do not read it.

**1. The hook (0:00 to 0:27)**
*On screen:* The landing page. Move the mouse slowly over the top so the network and the card react.

> Picture two people, same city, same morning. One takes a petrol cab. One takes the metro. *(pause)* Most incentives ignore that choice. They
> only reward what you **own**. That is backwards. This is MissionEV, a Strava for carbon. We reward the **journey** you chose, not the car
> you own. Three minutes: the idea, one trip, the proof.

**2. Sign in with a wallet (0:27 to 0:55)**
*On screen:* Press Launch the app, then Connect MetaMask and approve. A "wrong network" warning appears: press Switch to Portal V3 and approve the add-network pop-up.

> I tap Launch the app, then Connect MetaMask. That is the whole sign-up. No phone number. No password. *(pause)* My wallet is on the wrong
> network, so watch: one click adds Portal V3 and switches to it.

**3. One trip, calculated (0:55 to 1:42)**
*On screen:* Continue to capture trip, choose Metro and Simulated, press Start trip, then Verify trip. Start talking while the simulated trip runs (about 25 seconds). Scroll slowly past the four checks, then the carbon comparison and the reward preview.

> Now a trip. Metro, no car needed. This is a labelled simulation, so it says DEMO everywhere. The app runs four checks first. *(pause)* Then
> the carbon. This trip emits about 273 grams. The same distance on a petrol two-wheeler emits 441. The 167 grams saved are what we
> **reward**: twenty M-E-V per kilogram, plus a ten token metro bonus. About thirteen M-E-V, as a preview. And an electric car is counted
> fairly too, because the power station emits.

*Say the numbers you see. For the default demo route they are about 273 g, 441 g, 167 g and 13.3 $MEV.*

**4. The part that is real (1:42 to 2:20)**
*On screen:* Click the logo to go back to the landing page, scroll to "Ask the chain, right now", press Refresh, and move the mouse over the facts. Then switch to the terminal and run npm run contract:verify.

> Now, what is **real**. This panel asks Portal V3, live. *(pause)* The newest block is a few seconds old. Our contract has 5,088 bytes of
> code at this address. The owner and the verifier match our deployment record, and the EIP-712 check says Matches. Nothing is mocked. Nothing
> is sent. In the terminal, the same check says OK on every line.

**5. Where we are, and why Portal (2:20 to 2:50)**
*On screen:* Go back to the panel and point at "$MEV minted so far".

> So, where are we? The contract is live and verified. No journey is recorded on-chain yet. One transaction costs about 35 test tokens, and we
> are still getting them. I would rather tell you that than hide it. *(pause)* A verifier signs the trip, and your own wallet sends it, so we
> never hold your money. That design needs an EVM chain like Portal V3.

**6. Close (2:50 to 3:00)**

> MissionEV. Reward the **journey**, not the car. The code, the deck and the contract are in our repository. Thank you.

### If you manage to record a real transaction

Replace the first part of part 5 (down to "hide it") with the text below, and put the transaction hash in docs/SUBMISSION_ANSWERS.md. It needs the LIVE setup: the oracle key on a server you control, and about 35 tPOT in the wallet (see docs/DEPLOYMENT.md). The public demo cannot do it, because it deliberately holds no signing key.
*On screen:* a real-GPS trip, Verify & get oracle signature, Record on Portal from my wallet, MetaMask confirmation, then the transaction hash, block number and minted amount.

> Here is a real journey. The verifier signs it. *(pause)* MetaMask asks me to confirm. This is the transaction hash, this is the block, and
> this is the reward minted to my wallet.

### Things not to say

* That any $MEV was minted, or that the public demo sends transactions. It does not.
* That $MEV is a carbon credit. It is a prototype reward token.
* That the project uses Portal's WASM or cross-chain features. It uses the EVM layer only.
* That the community analytics are real. They are synthetic and labelled.

## After recording

1. Upload as Public on YouTube. The form asks for a publicly accessible link.
2. Open the link in a private window and check that it plays without signing in.
3. Paste it into the DoraHacks form, into docs/SUBMISSION_ANSWERS.md and near the top of the README.

## Pitch deck

The finished 9-slide deck is [`pitch/MissionEV-pitch-deck.pdf`](pitch/MissionEV-pitch-deck.pdf). Its source is [`pitch/deck.html`](pitch/deck.html):
open it in a browser and print to PDF (landscape, no margins, background graphics on) to regenerate it after an edit. The outline it follows:

1. **Title.** MissionEV, a Strava for carbon. One-line promise: reward the impact of the journey, not the vehicle.
2. **Problem.** Transport emissions are measured by fuel sold or vehicles owned, not by the trips people actually make. Incentives go to
   whoever owns the vehicle.
3. **Idea.** Measure each trip, compare it with a stated reference, reward the avoided CO2. Show the metro versus petrol-cab example.
4. **How it works.** The sequence diagram from [`ARCHITECTURE.md`](ARCHITECTURE.md): trip, oracle, wallet-submitted transaction.
5. **Why Portal V3 is essential.** EVM compatibility (EIP-712, `ecrecover`, ERC-20), commuter-submitted transactions, on-chain streaks and
   score, and an open record of every reward. Include the deployed address and transaction hash.
6. **Proof of functionality.** 100+ tests (the compiled contract runs in an in-process EVM), a verified live deployment, browser checks of
   the full flow, an audit of the supplied contract with fixes in v2.
7. **Honest limits and next steps.** Wallet connection rather than a signed login, in-memory oracle limits, placeholder metro and e-bus factors, no on-chain
   redeem. Roadmap: a durable store, Sign-In with Ethereum, sourced factors, a redeemable partner catalogue.
8. **Why continued support.** What it unlocks for the Portal ecosystem (reusable deploy and verify tooling, a worked EIP-712 oracle
   pattern) and the path to a pilot with a transit operator.
