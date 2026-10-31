import { connection } from "next/server";
import { json } from "@/server/http";
import { getRuntime } from "@/server/runtime";

/** GET /api/commuter/:address — the commuter's on-chain profile and current nonce, read server-side. */
export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  await connection();
  const { address } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return json({ status: "invalid", reason: "Not a valid address." }, 400);
  const { reader } = getRuntime();
  if (!reader) return json({ status: "unavailable", reason: "No contract address or RPC URL is configured, so nothing can be read from the chain." }, 503);
  try {
    const a = address as `0x${string}`;
    const [c, nonce] = await Promise.all([reader.commuter(a), reader.nonceOf(a)]);
    return json({ status: "ok", commuter: { ...c, balanceWei: c.balanceWei.toString() }, nonce: nonce.toString() });
  } catch {
    return json({ status: "unavailable", reason: "The chain couldn't be read." }, 503);
  }
}
