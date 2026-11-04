import { connection } from "next/server";
import { getChainStatus } from "@/server/chainStatus";
import { json } from "@/server/http";

/**
 * A live, read-only look at Portal V3 and the deployed contract (block height and age, contract code, token, supply, oracle,
 * owner, EIP-712 domain). Nothing here needs a key or sends anything. Answers are cached for a few seconds to spare the
 * shared public RPC; `connection()` keeps this a request-time read.
 */
export async function GET() {
  await connection();
  return json(await getChainStatus());
}
