import { createChainReader, type ChainReader } from "./chainReader";
import { readConfig, type ServerConfig } from "./config";
import { createMemoryStore, type SignStore } from "./signService";

/**
 * Per-process singletons for the route handlers. The sign store and the signed-trip log are in memory: they stand in for
 * the Cosmos DB (D2/D3) the architecture plans, and they reset when the process restarts.
 */
export interface SignedLogEntry {
  tripId: string;
  commuter: string;
  mode: number;
  modeName: string;
  distanceMeters: number;
  co2AvoidedGrams: number;
  nonce: string;
  deadline: number;
  signedAt: number;
}

const store: SignStore = createMemoryStore();
const log = new Map<string, SignedLogEntry>();
let reader: { key: string; value: ChainReader } | null = null;

export function getRuntime(): { config: ServerConfig; reader: ChainReader | null; store: SignStore; log: Map<string, SignedLogEntry> } {
  const config = readConfig();
  let r: ChainReader | null = null;
  if (config.contract && config.rpcUrl) {
    const key = `${config.contract}|${config.rpcUrl}`;
    if (reader?.key !== key) reader = { key, value: createChainReader(config) };
    r = reader.value;
  }
  return { config, reader: r, store, log };
}
