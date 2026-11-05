import { connection } from "next/server";
import { getRecentActivity } from "@/server/activity";
import { json } from "@/server/http";

/**
 * GET /api/activity: the latest recordCommute outcomes, read from the deployed contract's event logs. Read-only, no key and no
 * wallet. Like /api/chain it is a request-time read, cached for a few seconds to spare the shared public RPC. Failures come
 * back as a plain `unreachable` result (HTTP 200) so the page can say so; it never invents rows.
 */
export async function GET() {
  await connection();
  return json(await getRecentActivity());
}
