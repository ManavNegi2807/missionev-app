import { connection } from "next/server";
import { json } from "@/server/http";
import { getRuntime } from "@/server/runtime";

/**
 * GET /api/rewards/:address — the real $MEV balance for an address (`balanceOf`, 18 decimals) plus the contract's streak and
 * score. Amounts are decimal strings of wei so nothing is rounded in transit. This is the prototype reward token, not a
 * certified carbon credit, and it is a different thing from the tPOT gas balance.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  await connection();
  const { address } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return json({ status: "invalid", reason: "Not a valid address." }, 400);
  const { reader } = getRuntime();
  if (!reader) return json({ status: "unavailable", reason: "No contract address or RPC URL is configured, so no balance can be read." }, 503);
  try {
    const c = await reader.commuter(address as `0x${string}`);
    return json({ status: "ok", token: { symbol: "MEV", name: "MissionEV Carbon Reward", decimals: 18, certifiedCarbonCredit: false }, balanceWei: c.balanceWei.toString(), streakDays: c.streakDays, carbonScore: c.carbonScore, totalAvoidedGramsCO2: c.totalAvoidedGramsCO2, totalTripsLogged: c.totalTripsLogged });
  } catch {
    return json({ status: "unavailable", reason: "The chain couldn't be read." }, 503);
  }
}
