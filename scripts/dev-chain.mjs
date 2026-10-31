// A LOCAL, in-memory EVM with a JSON-RPC endpoint and the compiled MissionEV contract deployed, for trying the LIVE flow
// without touching Portal or any real network. DEV ONLY: every `from` address is "unlocked" (impersonated), nothing is
// persisted, and the oracle key it prints is a throwaway.
//
//   npm run contract:compile        (once, builds contracts/artifacts)
//   npm run dev:chain               prints the env vars to put in .env.local, then serves http://127.0.0.1:8545
//
// It speaks just enough JSON-RPC for MissionEV: eth_chainId, eth_call, eth_sendTransaction, receipts, logs, balances.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBlock } from "@ethereumjs/block";
import { Hardfork, Mainnet, createCustomCommon } from "@ethereumjs/common";
import { createAccount, createAddressFromString, bytesToHex, hexToBytes } from "@ethereumjs/util";
import { createVM } from "@ethereumjs/vm";
import { encodeDeployData, keccak256 } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifact = JSON.parse(readFileSync(join(root, "contracts", "artifacts", "MissionEV.json"), "utf8"));
const CHAIN_ID = 420420777;
const PORT = Number(process.env.DEV_CHAIN_PORT ?? 8545);
const oracleKey = process.env.ORACLE_PRIVATE_KEY ?? generatePrivateKey();
const oracle = privateKeyToAccount(oracleKey);

const common = createCustomCommon({ chainId: CHAIN_ID }, Mainnet, { hardfork: Hardfork.Cancun });
const vm = await createVM({ common });
const deployer = "0x00000000000000000000000000000000000d3b10";
const FUND = BigInt("1000000000000000000000");
const hex = (n) => `0x${BigInt(n).toString(16)}`;
const funded = new Set();
async function fund(addr) {
  const k = addr.toLowerCase();
  if (funded.has(k)) return;
  funded.add(k);
  const a = createAddressFromString(addr);
  const acc = await vm.stateManager.getAccount(a);
  if (!acc || acc.balance === BigInt(0)) await vm.stateManager.putAccount(a, createAccount({ balance: FUND }));
}

let blockNumber = 0;
let lastTs = Math.floor(Date.now() / 1000);
const blocks = new Map(); // number -> { timestamp, hash }
const receipts = new Map(); // tx hash -> receipt
const allLogs = [];
let txCount = 0;
const nonces = new Map();

const mine = () => {
  blockNumber += 1;
  lastTs = Math.max(lastTs + 1, Math.floor(Date.now() / 1000));
  const hash = keccak256(`0x${blockNumber.toString(16).padStart(64, "0")}`);
  blocks.set(blockNumber, { timestamp: lastTs, hash });
  return { number: blockNumber, timestamp: lastTs, hash };
};
const blockCtx = (ts) => createBlock({ header: { number: BigInt(blockNumber + 1), timestamp: BigInt(ts), gasLimit: BigInt(30_000_000) } }, { common });

async function run(from, to, data, { commit }) {
  await fund(from);
  if (!commit) await vm.stateManager.checkpoint();
  try {
    return await vm.evm.runCall({ caller: createAddressFromString(from), to: to ? createAddressFromString(to) : undefined, data: data ? hexToBytes(data) : new Uint8Array(), gasLimit: BigInt(10_000_000), block: blockCtx(Math.max(lastTs, Math.floor(Date.now() / 1000))) });
  } finally {
    if (!commit) await vm.stateManager.revert();
  }
}

// deploy MissionEV(oracle)
mine();
const dep = await run(deployer, undefined, encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args: [oracle.address] }), { commit: true });
if (dep.execResult.exceptionError || !dep.createdAddress) throw new Error("deploy failed");
const contract = dep.createdAddress.toString();

const toHexLog = (l, txHash, bn, idx) => ({ address: bytesToHex(l[0]), topics: l[1].map((t) => bytesToHex(t)), data: bytesToHex(l[2]), blockNumber: hex(bn), transactionHash: txHash, transactionIndex: "0x0", blockHash: blocks.get(bn)?.hash, logIndex: hex(idx), removed: false });

async function sendTx(p) {
  const from = p.from.toLowerCase();
  const res = await run(from, p.to, p.data, { commit: true });
  const b = mine();
  const n = (nonces.get(from) ?? 0) + 1;
  nonces.set(from, n);
  const txHash = keccak256(`0x${Buffer.from(`${from}:${n}:${txCount++}:${p.data ?? ""}`).toString("hex")}`);
  const ok = !res.execResult.exceptionError;
  const logs = ok ? (res.execResult.logs ?? []).map((l, i) => toHexLog(l, txHash, b.number, allLogs.length + i)) : [];
  allLogs.push(...logs);
  receipts.set(txHash, { transactionHash: txHash, transactionIndex: "0x0", blockHash: b.hash, blockNumber: hex(b.number), from, to: p.to?.toLowerCase() ?? null, cumulativeGasUsed: hex(res.execResult.executionGasUsed), gasUsed: hex(res.execResult.executionGasUsed), status: ok ? "0x1" : "0x0", logs, logsBloom: `0x${"0".repeat(512)}`, type: "0x0", effectiveGasPrice: "0x0", contractAddress: null });
  return txHash;
}

const matchTopic = (want, have) => want === null || want === undefined || (Array.isArray(want) ? want.includes(have) : want === have);
async function rpc(method, params = []) {
  switch (method) {
    case "eth_chainId": return hex(CHAIN_ID);
    case "net_version": return String(CHAIN_ID);
    case "web3_clientVersion": return "missionev-dev-chain/1";
    case "eth_blockNumber": return hex(blockNumber);
    case "eth_gasPrice": return "0x0";
    case "eth_estimateGas": return "0x7a120";
    case "eth_maxPriorityFeePerGas": return "0x0";
    case "eth_getBalance": { await fund(params[0]); return hex((await vm.stateManager.getAccount(createAddressFromString(params[0])))?.balance ?? 0); }
    case "eth_getTransactionCount": return hex(nonces.get(params[0].toLowerCase()) ?? 0);
    case "eth_getCode": { const c = await vm.stateManager.getCode(createAddressFromString(params[0])); return bytesToHex(c); }
    case "eth_call": { const r = await run(params[0].from ?? deployer, params[0].to, params[0].data, { commit: false }); if (r.execResult.exceptionError) throw Object.assign(new Error("execution reverted"), { code: 3, data: bytesToHex(r.execResult.returnValue) }); return bytesToHex(r.execResult.returnValue); }
    case "eth_sendTransaction": return sendTx(params[0]);
    case "eth_getTransactionReceipt": return receipts.get(params[0]) ?? null;
    case "eth_getBlockByNumber": { const n = params[0] === "latest" ? blockNumber : Number.parseInt(params[0], 16); const b = blocks.get(n); return b ? { number: hex(n), hash: b.hash, parentHash: blocks.get(n - 1)?.hash ?? `0x${"0".repeat(64)}`, timestamp: hex(b.timestamp), transactions: [], gasLimit: hex(30_000_000), gasUsed: "0x0", baseFeePerGas: "0x0" } : null; }
    case "eth_getLogs": {
      const f = params[0];
      const from = f.fromBlock && f.fromBlock !== "earliest" && f.fromBlock !== "latest" ? Number.parseInt(f.fromBlock, 16) : 0;
      const to = f.toBlock && f.toBlock !== "latest" ? Number.parseInt(f.toBlock, 16) : blockNumber;
      return allLogs.filter((l) => { const bn = Number.parseInt(l.blockNumber, 16); return bn >= from && bn <= to && (!f.address || f.address.toLowerCase() === l.address.toLowerCase()) && (f.topics ?? []).every((t, i) => matchTopic(t, l.topics[i])); });
    }
    default: throw Object.assign(new Error(`method not supported by the dev chain: ${method}`), { code: -32601 });
  }
}

createServer(async (req, res) => {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };
  if (req.method === "OPTIONS") return void res.writeHead(204, cors).end();
  let body = "";
  for await (const c of req) body += c;
  const one = async (m) => {
    try { return { jsonrpc: "2.0", id: m.id, result: await rpc(m.method, m.params) }; }
    catch (e) { return { jsonrpc: "2.0", id: m.id, error: { code: e.code ?? -32000, message: e.message, data: e.data } }; }
  };
  const msg = JSON.parse(body);
  const out = Array.isArray(msg) ? await Promise.all(msg.map(one)) : await one(msg);
  res.writeHead(200, { "content-type": "application/json", ...cors }).end(JSON.stringify(out));
}).listen(PORT, "127.0.0.1", () => {
  const info = { rpc: `http://127.0.0.1:${PORT}`, chainId: CHAIN_ID, contract, oracleAddress: oracle.address, oracleKey };
  console.log("MissionEV dev chain (in-memory, DEV ONLY) — put these in .env.local:\n");
  console.log(`MISSIONEV_CONTRACT_ADDRESS=${contract}\nNEXT_PUBLIC_MEV_CONTRACT_ADDRESS=${contract}\nPORTAL_RPC_URL=${info.rpc}\nNEXT_PUBLIC_PORTAL_RPC_URL=${info.rpc}\nORACLE_PRIVATE_KEY=${oracleKey}\n`);
  console.log(`READY ${JSON.stringify(info)}`);
});
