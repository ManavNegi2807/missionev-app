import { createBlock } from "@ethereumjs/block";
import { Hardfork, Mainnet, createCustomCommon } from "@ethereumjs/common";
import { createAddressFromString, createAccount, bytesToHex, hexToBytes } from "@ethereumjs/util";
import { createVM } from "@ethereumjs/vm";
import { decodeErrorResult, decodeFunctionResult, encodeDeployData, encodeFunctionData, type Abi, type Hex } from "viem";
import artifact from "../../contracts/artifacts/MissionEV.json";
import proposed from "../../contracts/artifacts/MissionEVv2.proposed.json";
import { PORTAL_V3 } from "@/lib/chain";

/**
 * A tiny in-process EVM for contract tests, running the COMPILED contract bytecode (contracts/artifacts) on a chain with
 * Portal V3's chain id, so the contract's block.chainid-bound DOMAIN_SEPARATOR matches the one the app signs against.
 * It mines nothing and keeps no history: each call executes in a block whose timestamp the test chooses.
 */
export const MISSIONEV_ABI = artifact.abi as Abi;
export const MISSIONEV_V2_ABI = proposed.abi as Abi;

export interface Chain {
  chainId: number;
  /** Seconds since epoch used for the next calls; tests move it to test deadlines and streaks. */
  now: number;
  deploy(args: { from: Hex; abi: Abi; bytecode: Hex; ctorArgs?: unknown[] }): Promise<Hex>;
  /** State-changing call. Resolves to `{ ok: true, logs }` or `{ ok: false, reason }`. */
  send(args: { from: Hex; to: Hex; abi: Abi; fn: string; args?: unknown[] }): Promise<{ ok: true; logs: unknown[]; gasUsed: bigint } | { ok: false; reason: string }>;
  /** Read-only call; throws on revert. */
  read<T = unknown>(args: { to: Hex; abi: Abi; fn: string; args?: unknown[]; from?: Hex }): Promise<T>;
}

export async function createChain(): Promise<Chain> {
  const common = createCustomCommon({ chainId: PORTAL_V3.chainId }, Mainnet, { hardfork: Hardfork.Cancun });
  const vm = await createVM({ common });
  const funded = new Set<string>();
  const state: { now: number } = { now: Math.floor(Date.UTC(2026, 1, 10, 12) / 1000) };

  const fund = async (who: Hex) => {
    if (funded.has(who.toLowerCase())) return;
    funded.add(who.toLowerCase());
    const addr = createAddressFromString(who);
    const existing = await vm.stateManager.getAccount(addr);
    if (existing && existing.balance > BigInt(0)) return;
    await vm.stateManager.putAccount(addr, createAccount({ balance: BigInt("1000000000000000000000") }));
  };
  const blockAt = () => createBlock({ header: { number: BigInt(1000), timestamp: BigInt(state.now), gasLimit: BigInt(30_000_000) } }, { common });

  const run = async (from: Hex, to: Hex | undefined, data: Hex) => {
    await fund(from);
    return vm.evm.runCall({
      caller: createAddressFromString(from),
      to: to ? createAddressFromString(to) : undefined,
      data: hexToBytes(data),
      gasLimit: BigInt(10_000_000),
      block: blockAt(),
    });
  };
  const revertReason = (abi: Abi, ret: Uint8Array, exceptionError?: { error?: string } | null): string => {
    if (ret.length >= 4) {
      try {
        const e = decodeErrorResult({ abi: [...abi, { type: "error", name: "Error", inputs: [{ name: "message", type: "string" }] }, { type: "error", name: "Panic", inputs: [{ name: "code", type: "uint256" }] }] as Abi, data: bytesToHex(ret) });
        return `${e.errorName}: ${e.args?.map(String).join(", ")}`;
      } catch {
        /* fall through */
      }
    }
    return exceptionError?.error ?? "reverted";
  };

  return {
    chainId: PORTAL_V3.chainId,
    get now() {
      return state.now;
    },
    set now(v: number) {
      state.now = v;
    },
    async deploy({ from, abi, bytecode, ctorArgs }) {
      const data = encodeDeployData({ abi, bytecode, args: ctorArgs ?? [] });
      const res = await run(from, undefined, data);
      if (res.execResult.exceptionError || !res.createdAddress) throw new Error(`deploy failed: ${revertReason(abi, res.execResult.returnValue, res.execResult.exceptionError)}`);
      return res.createdAddress.toString() as Hex;
    },
    async send({ from, to, abi, fn, args }) {
      const res = await run(from, to, encodeFunctionData({ abi, functionName: fn, args: args ?? [] }));
      if (res.execResult.exceptionError) return { ok: false, reason: revertReason(abi, res.execResult.returnValue, res.execResult.exceptionError) };
      return { ok: true, logs: res.execResult.logs ?? [], gasUsed: res.execResult.executionGasUsed };
    },
    async read<T>({ to, abi, fn, args, from }: { to: Hex; abi: Abi; fn: string; args?: unknown[]; from?: Hex }) {
      const res = await run(from ?? "0x000000000000000000000000000000000000dEaD", to, encodeFunctionData({ abi, functionName: fn, args: args ?? [] }));
      if (res.execResult.exceptionError) throw new Error(revertReason(abi, res.execResult.returnValue, res.execResult.exceptionError));
      return decodeFunctionResult({ abi, functionName: fn, data: bytesToHex(res.execResult.returnValue) }) as T;
    },
  };
}

export { artifact, proposed };
