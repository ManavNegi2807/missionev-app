import { FUEL_FACTORS, REFERENCE_VEHICLES } from "@/lib/carbon/emissionFactors";
import { MIN_RANKED_JOURNEYS } from "./demo-data";

const refG = (body: "car" | "two_wheeler") => ((FUEL_FACTORS.petrol.value * 1000) / REFERENCE_VEHICLES[body].kmPerLitre).toFixed(1);

/** One place for every metric definition so Screen 04, its exports and the other screens never drift apart. */
export const DEFINITIONS: Array<{ term: string; text: string }> = [
  { term: "Verified journey", text: "A trip whose Screen 02 verification finished VERIFIED (all applicable checks passed, trust tier not Rejected) and that has a carbon calculation. Every impact aggregate counts verified journeys only; unverified journeys appear only in the verified-trip share." },
  { term: "Reference journey (baseline)", text: `The same distance travelled by a reference petrol vehicle: a petrol car (${refG("car")} g CO₂e/km at ${REFERENCE_VEHICLES.car.kmPerLitre} km/l) for cars, or a petrol two-wheeler (${refG("two_wheeler")} g CO₂e/km at ${REFERENCE_VEHICLES.two_wheeler.kmPerLitre} km/l) for two-wheelers, metro, bus and walking. Both are MissionEV assumptions, not measured fleet averages.` },
  { term: "Estimated actual emissions", text: "Direct energy-use emissions on one boundary for every mode: fuel burnt in the vehicle for petrol and diesel, and electricity drawn from the grid × the CEA national grid factor for EVs, metro and electric buses. Vehicle and battery manufacturing and fuel supply chains are excluded. Metro and bus factors are low-confidence estimates." },
  { term: "Estimated avoided emissions", text: "Reference minus actual, counted only when a journey is below the reference, floored to whole grams. A journey above the reference avoids 0 g (it does not subtract), so reference − actual can differ from avoided. This is an estimate, not a certified carbon credit." },
  { term: "Clean mobility", text: "Lower-emission categories: EV, Metro, Electric bus, Walking / cycling. EV charging emissions are still counted in the estimate. Clean share = clean verified journeys ÷ verified journeys." },
  { term: "Clean streak", text: "Consecutive days, ending on the period's last day (or the day before it), with at least one verified clean journey." },
  { term: "Mobility score", text: "0–100 = 50% clean-journey share + 30% clean streak (capped at 14 days) + 20% share of reference emissions avoided." },
  { term: "Leaderboard ranking rule", text: `Commuters with at least ${MIN_RANKED_JOURNEYS} verified journeys in the period are ranked by mobility score, then avoided emissions, then verified journeys, then alias. Others are listed as unranked.` },
  { term: "$MEV earned", text: "$MEV the MissionEV contract mints for journeys the oracle signed and the commuter's wallet recorded: 20 MEV per kg avoided × a streak multiplier (1×–3×) + a mode bonus. Only lower-emission journeys are signed; petrol and diesel journeys never are. Demo journeys are credited in the browser only and are labelled DEMO. Pending = verified but not recorded yet. $MEV is a prototype reward token, not a certified carbon credit." },
  { term: "$MEV redeemed", text: "Simulated redemptions (D4). The contract has no redeem or burn function, so nothing is spent on-chain. Native tPOT gas is a separate currency and is never included." },
];
