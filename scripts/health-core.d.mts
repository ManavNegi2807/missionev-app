export const PORTAL_V3_CHAIN_ID: number;
export const LIMITS: { maxHeadAgeSec: number; maxEvmLagBlocks: number; maxFinalityLagBlocks: number };

export interface EvmStatus {
  chainId: number;
  head: number;
  /** Unix seconds. */
  headTimestamp: number;
}

export interface NativeStatus {
  chain: string;
  head: number;
  finalized: number;
  peers: number;
  isSyncing: boolean;
  shouldHavePeers: boolean;
}

export interface Finding {
  level: "ok" | "warn" | "fail";
  text: string;
}

export function assess(input: { evm: EvmStatus | null; native: NativeStatus | null; now?: number; limits?: typeof LIMITS }): {
  verdict: "healthy" | "degraded" | "unhealthy";
  findings: Finding[];
};

export function formatAge(sec: number): string;
