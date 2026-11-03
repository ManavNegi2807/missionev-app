import { PORTAL_V3 } from "@/lib/chain";

/** Public facts the landing page shows. All of them are also in the README and docs/DEPLOYMENT.md. */
export const REPO_URL = "https://github.com/ManavNegi2807/missionev-app";
export const DOCS_URL = `${REPO_URL}/tree/master/docs`;

export const DEPLOYED_CONTRACT = "0x0904244017324dc1bf7c611fe1236936ee65fc82";
export const DEPLOY_TX = "0x11562d9b34bc9236413a1d49a7712179d8f50defdc610b3c81c6dbf01d9ca965";
export const DEPLOY_PROOF_URL = `https://portalindex-98f0.onrender.com/evm_transactions?tx_hash=eq.${DEPLOY_TX}`;

export const CHAIN_ID = PORTAL_V3.chainId;

/** CEA CO2 Baseline Database v22.0, national weighted-average grid rate, FY 2025-26 (see src/lib/carbon/emissionFactors.ts). */
export const GRID_FACTOR_KG_PER_KWH = 0.6751;
