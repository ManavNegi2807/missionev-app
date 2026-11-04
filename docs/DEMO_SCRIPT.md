# Demo video script (3 minutes maximum) and pitch outline

The organisers ask for a public video under 3 minutes that shows the real product and Portaldot use, "ideally featuring actual testnet
interactions". This script is about 300 spoken words, which is 2 min 20 s to 2 min 45 s depending on how fast you speak, so there is room for clicks and pauses.
Read it once, then say it in your own words. Short sentences are better than perfect ones.

**Be honest on camera.** Say "simulation" when it is one. Do not say anything was minted: nothing has been yet. The app labels every
simulated result, and judges reward honesty over polish.

## Before you record (10 minutes)

1. Use a **throwaway MetaMask account** with no funds. Never show a seed phrase or a private key. The pop-ups only show the address.
2. In MetaMask, **remove the Portal V3 network** if you added it before (Settings, Networks), so the video can show it being added.
3. Close other tabs and notifications. Browser window about 1280 to 1440 px wide, zoom 100 to 110%, light theme.
4. Open https://missionev.vercel.app in a **new private window** (nothing saved from before). In a second window, have a terminal in the project
   folder ready to run `npm run contract:verify` (see the command in the README).
5. Record screen and voice together: **Win + G** (Xbox Game Bar) or OBS Studio (free). A quiet room and earphones with a mic are enough.
6. Do one dry run with a timer.

## The script

Each part has what to do on screen, then what to say.

**1. The idea (0:00 to 0:18)**
*On screen:* the landing page. Move the mouse slowly over the top so the network and the card react.

> Most green-transport rewards pay for what you own. But what matters is the trip you took. MissionEV is a Strava for carbon. It measures
> each journey, and rewards the carbon you really saved.

**2. Sign in with a wallet (0:18 to 0:45)**
*On screen:* press **Launch the app**, then **Connect MetaMask** and approve. A "wrong network" warning appears: press **Switch to Portal V3**
and approve the add-network pop-up.

> I press Launch the app, then Connect MetaMask. My wallet is my account. No phone number, no password. My wallet is on the wrong network,
> so one click adds Portal V3, chain id 420420777, and switches to it.

**3. One trip, calculated (0:45 to 1:35)**
*On screen:* **Continue to capture trip**, choose **Metro** and **Simulated**, press **Start trip**, then **Verify trip**. Scroll slowly past the
four checks, the trust tier, then the carbon comparison and the reward preview.

> Now a trip. I choose metro. No car is needed. This is a labelled simulation, so it says DEMO everywhere. The app runs four checks and gives
> the trip an evidence tier. Then the carbon. This metro trip emits about 273 grams. The same distance on a petrol two-wheeler emits about 441.
> So 167 grams are avoided. The reward is twenty M-E-V per kilogram, plus a ten token metro bonus: about 13 M-E-V. It is only a preview.
> Nothing is minted here.

*Say the numbers you see. For the default demo route they are about 273 g, 441 g, 167 g and 13.3 $MEV.*

**4. The part that is real (1:35 to 2:20)**
*On screen:* click the logo to go back to the landing page, scroll to **Ask the chain, right now**, press **Refresh**, and move the mouse over
the facts. Then switch to the terminal and run `npm run contract:verify`.

> Now the part that is real. This panel asks Portal V3, live. The latest block is a few seconds old. The MissionEV contract has 5,088 bytes of
> code at this address. The token is MissionEV Carbon Reward. The owner and the verifier match our deployment record, and the EIP-712 check says
> Matches. Nothing is mocked, and nothing is sent. In the terminal, the same check says OK on every line.

**5. Honest status, and why Portal (2:20 to 2:50)**
*On screen:* go back to the panel and point at **$MEV minted so far**.

> To be honest about status: the contract is live, but no journey is recorded on-chain yet. One transaction costs about 35 test tokens in gas,
> and we are still getting them. The design is simple. A verifier signs the trip, and my own wallet sends the transaction, so we never hold
> anyone's money. That needs an EVM chain like Portal V3.

**6. Close (2:50 to 3:00)**

> MissionEV. Reward the journey, not the car. The code, the deck and the contract are all in our repository. Thank you.

### If you manage to record a real transaction

Replace the first two sentences of part 5 with this, and put its transaction hash in [`SUBMISSION_ANSWERS.md`](SUBMISSION_ANSWERS.md).
It needs the LIVE setup (the oracle key on a server you control, and about 35 tPOT in the wallet; see [`DEPLOYMENT.md`](DEPLOYMENT.md)).
The public demo cannot do it, because it deliberately holds no signing key.
*On screen:* a real-GPS trip, **Verify & get oracle signature**, **Record on Portal from my wallet**, MetaMask confirmation, then the
transaction hash, block number and minted amount.

> Here is a real journey. The verifier signs it. MetaMask asks me to confirm. This is the transaction hash, this is the block, and this is the
> M-E-V minted to my wallet.

### Things not to say

* That any $MEV was minted, or that the public demo sends transactions. It does not.
* That $MEV is a carbon credit. It is a prototype reward token.
* That the project uses Portal's WASM or cross-chain features. It uses the EVM layer only.
* That the community analytics are real. They are synthetic and labelled.

## After recording

1. Upload as **Public** on YouTube. The form asks for a publicly accessible link.
2. Open the link in a private window and check that it plays without signing in.
3. Paste it into the DoraHacks form, into [`SUBMISSION_ANSWERS.md`](SUBMISSION_ANSWERS.md) and near the top of the README.

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
