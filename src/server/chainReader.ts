import { createPublicClient, http, type Hex } from "viem";
import { MISSIONEV_ABI } from "@/lib/contract/missionev.abi";
import { portalChain } from "@/lib/contract/chain";
import type { CommuterState } from "@/lib/carbon/rewardPreview";
import type { ServerConfig } from "./config";

/** The read-only chain access the oracle needs. An interface so tests can back it with an in-process EVM. */
export interface ChainReader {
  nonceOf(commuter: Hex): Promise<bigint>;
  isTripProcessed(tripId: Hex): Promise<boolean>;
  oracleSigner(): Promise<Hex>;
  commuter(address: Hex): Promise<CommuterState & { balanceWei: bigint }>;
  hasCode(): Promise<boolean>;
}

export function createChainReader(cfg: Pick<ServerConfig, "contract" | "rpcUrl">): ChainReader {
  if (!cfg.contract || !cfg.rpcUrl) throw new Error("Chain reader needs a contract address and an RPC URL.");
  const address = cfg.contract;
  const client = createPublicClient({ chain: portalChain(cfg.rpcUrl), transport: http(cfg.rpcUrl, { timeout: 10_000, retryCount: 1 }) });
  const read = <T,>(functionName: string, args: unknown[] = []) => client.readContract({ address, abi: MISSIONEV_ABI, functionName: functionName as never, args: args as never }) as Promise<T>;
  return {
    nonceOf: (c) => read<bigint>("nonces", [c]),
    isTripProcessed: (id) => read<boolean>("processedTrips", [id]),
    oracleSigner: () => read<Hex>("azureOracleSigner"),
    async commuter(a) {
      const [carbonScore, streakDays, lastTripTimestamp, totalAvoidedGramsCO2, totalTripsLogged, tokenBalance] = await read<readonly bigint[]>("getCommuter", [a]);
      return {
        carbonScore: Number(carbonScore),
        streakDays: Number(streakDays),
        lastTripTimestamp: Number(lastTripTimestamp),
        totalAvoidedGramsCO2: Number(totalAvoidedGramsCO2),
        totalTripsLogged: Number(totalTripsLogged),
        balanceWei: tokenBalance,
      };
    },
    async hasCode() {
      const code = await client.getCode({ address });
      return Boolean(code && code !== "0x");
    },
  };
}
