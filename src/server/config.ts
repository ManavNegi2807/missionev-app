import type { Hex } from "viem";
import { PORTAL_V3 } from "@/lib/chain";

/**
 * Server-side configuration. Everything secret lives here and is read from server-only environment variables:
 * none of these names starts with NEXT_PUBLIC_, so none can reach the browser bundle.
 *
 *   ORACLE_PRIVATE_KEY            0x… signing key of the address the contract was deployed with (azureOracleSigner)
 *   MISSIONEV_CONTRACT_ADDRESS    deployed MissionEV address (falls back to NEXT_PUBLIC_MEV_CONTRACT_ADDRESS, which is public anyway)
 *   PORTAL_RPC_URL                JSON-RPC endpoint for nonce and state reads (falls back to NEXT_PUBLIC_PORTAL_RPC_URL)
 *   AZURE_VISION_ENDPOINT / AZURE_VISION_KEY   Azure AI Vision resource used for receipt OCR
 *   ORACLE_SIGNATURE_TTL_SECONDS  how long a signature stays valid (default 600)
 *   ORACLE_MAX_TRIPS_PER_DAY      signatures per commuter per UTC day (default 8)
 */
export interface ServerConfig {
  chainId: number;
  contract: Hex | null;
  rpcUrl: string | null;
  oracleKey: Hex | null;
  signatureTtlSeconds: number;
  maxTripsPerDay: number;
  vision: { endpoint: string; key: string } | null;
}

const isAddress = (s: string | undefined): s is Hex => Boolean(s && /^0x[0-9a-fA-F]{40}$/.test(s));
const isKey = (s: string | undefined): s is Hex => Boolean(s && /^0x[0-9a-fA-F]{64}$/.test(s));
const posInt = (s: string | undefined, d: number) => (s && Number.isInteger(Number(s)) && Number(s) > 0 ? Number(s) : d);

export function readConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const contract = env.MISSIONEV_CONTRACT_ADDRESS || env.NEXT_PUBLIC_MEV_CONTRACT_ADDRESS;
  const rpc = env.PORTAL_RPC_URL || env.NEXT_PUBLIC_PORTAL_RPC_URL;
  return {
    chainId: PORTAL_V3.chainId,
    contract: isAddress(contract) ? contract : null,
    rpcUrl: rpc && /^https?:\/\//.test(rpc) ? rpc : null,
    oracleKey: isKey(env.ORACLE_PRIVATE_KEY) ? env.ORACLE_PRIVATE_KEY : null,
    signatureTtlSeconds: Math.min(3600, posInt(env.ORACLE_SIGNATURE_TTL_SECONDS, 600)),
    maxTripsPerDay: posInt(env.ORACLE_MAX_TRIPS_PER_DAY, 8),
    vision: env.AZURE_VISION_ENDPOINT && env.AZURE_VISION_KEY ? { endpoint: env.AZURE_VISION_ENDPOINT.replace(/\/+$/, ""), key: env.AZURE_VISION_KEY } : null,
  };
}

export interface IntegrationStatus {
  /** LIVE needs all three; otherwise the app runs in clearly-labelled DEMO. */
  mode: "LIVE" | "DEMO";
  chainId: number;
  contract: { configured: boolean; address: string | null };
  rpc: { configured: boolean };
  oracle: { configured: boolean };
  ocr: { configured: boolean; provider: "azure-ai-vision" };
  otp: { delivery: "demo"; note: string };
  missing: string[];
}

/** What is configured, never the secrets themselves. Safe to send to the browser. */
export function integrationStatus(cfg: ServerConfig): IntegrationStatus {
  const missing: string[] = [];
  if (!cfg.contract) missing.push("MISSIONEV_CONTRACT_ADDRESS");
  if (!cfg.rpcUrl) missing.push("PORTAL_RPC_URL");
  if (!cfg.oracleKey) missing.push("ORACLE_PRIVATE_KEY");
  return {
    mode: missing.length === 0 ? "LIVE" : "DEMO",
    chainId: cfg.chainId,
    contract: { configured: Boolean(cfg.contract), address: cfg.contract },
    rpc: { configured: Boolean(cfg.rpcUrl) },
    oracle: { configured: Boolean(cfg.oracleKey) },
    ocr: { configured: Boolean(cfg.vision), provider: "azure-ai-vision" },
    otp: { delivery: "demo", note: "No SMS provider is configured. The OTP is a fixed demo value and no message is sent." },
    missing,
  };
}
