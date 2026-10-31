import { connection } from "next/server";
import { integrationStatus } from "@/server/config";
import { json } from "@/server/http";
import { getRuntime } from "@/server/runtime";

/** What this server has configured (never the secrets). `connection()` keeps it a request-time read, not a build-time snapshot. */
export async function GET() {
  await connection();
  return json(integrationStatus(getRuntime().config));
}
