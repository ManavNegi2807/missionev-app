import { connection } from "next/server";
import { json } from "@/server/http";
import { getRuntime } from "@/server/runtime";

/**
 * GET /api/trips/:tripId — what the oracle signed for this trip id (from this server's memory) and whether the contract
 * has processed it. The memory stands in for the future Cosmos DB trip store and is empty after a restart; the on-chain
 * `processedTrips` flag is the durable truth.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  await connection();
  const { tripId } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(tripId)) return json({ status: "invalid", reason: "A trip id is 32 bytes (0x + 64 hex characters)." }, 400);
  const { reader, log } = getRuntime();
  const signed = log.get(tripId) ?? null;
  let processed: boolean | null = null;
  if (reader) processed = await reader.isTripProcessed(tripId as `0x${string}`).catch(() => null);
  if (!signed && processed === null) return json({ status: "unknown", reason: "This server has no record of that trip and can't read the chain." }, 404);
  return json({ status: "ok", signedByThisServer: signed, processedOnChain: processed });
}
