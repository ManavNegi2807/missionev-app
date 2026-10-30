import { EMISSION_CONFIG } from "@/lib/trip/emissions";
import { MIN_RANKED_JOURNEYS } from "./demo-data";

/** One place for every metric definition so Screen 04, its exports and the other screens never drift apart. */
export const DEFINITIONS: Array<{ term: string; text: string }> = [
  { term: "Verified journey", text: "A trip whose Screen 02 verification finished VERIFIED (all applicable checks passed, trust tier not Rejected) and that has an emission result. Every impact aggregate counts verified journeys only; unverified journeys appear only in the verified-trip share." },
  { term: "Estimated baseline", text: `The same distance travelled by an average petrol two-wheeler (${(EMISSION_CONFIG.baselineMgPerKm / 1000).toFixed(1)} g CO₂/km, the Journey Lab baseline).` },
  { term: "Estimated actual emissions", text: "Tailpipe plus electricity-generation emissions for the vehicle used, from the Journey Lab factors. Transit and walking use illustrative per-passenger-km placeholders (not in the deployed contract)." },
  { term: "Estimated avoided emissions", text: "Journey Lab rule: baseline minus actual, counted only when a journey is below baseline, floored to whole grams. A journey above baseline avoids 0 g (it does not subtract), so baseline − actual can differ from avoided. This is an estimate, not a certified carbon credit." },
  { term: "Clean mobility", text: "Zero-tailpipe categories: EV, Metro, Electric bus, Walking / cycling. Grid emissions of EVs are still counted in the estimate. Clean share = clean verified journeys ÷ verified journeys." },
  { term: "Clean streak", text: "Consecutive days, ending on the period's last day (or the day before it), with at least one verified clean journey." },
  { term: "Mobility score", text: "0–100 = 50% clean-journey share + 30% clean streak (capped at 14 days) + 20% share of baseline emissions avoided." },
  { term: "Leaderboard ranking rule", text: `Commuters with at least ${MIN_RANKED_JOURNEYS} verified journeys in the period are ranked by mobility score, then avoided emissions, then verified journeys, then alias. Others are listed as unranked.` },
  { term: "$MEV earned", text: "Tokens of verified journeys whose on-chain record was recorded (demo: previewed on Screen 02), plus local demo top-ups. Tokens follow the contract rules: grams-per-token, trust tier and daily cap. Pending = verified but not recorded yet. Only vehicle classes the contract knows can earn." },
  { term: "$MEV redeemed", text: "Completed or simulated redemptions (D4). Native tPOT gas is a separate currency and is never included." },
];
