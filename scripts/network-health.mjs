// Is Portal V3 healthy right now? Compares the EVM endpoint with the native node and says so. Read-only.
//
//   npm run network:health
//   PORTAL_RPC_URL=https://… PORTAL_WS_URL=wss://… npm run network:health
//
// Exit code: 0 healthy, 1 degraded (a warning), 2 unhealthy (do not deploy or send transactions now).
import { assess } from "./health-core.mjs";

const EVM_URL = process.env.PORTAL_RPC_URL ?? "https://test-evm-rpc-v3.portaldot.dev";
const WS_URL = process.env.PORTAL_WS_URL ?? "wss://test-node-v3.portaldot.dev";
const TIMEOUT_MS = 15_000;

async function evmStatus() {
  const rpc = async (method, params = []) => {
    const res = await fetch(EVM_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await res.json();
    if (body.error) throw new Error(body.error.message ?? "RPC error");
    return body.result;
  };
  try {
    const [chainId, block] = await Promise.all([rpc("eth_chainId"), rpc("eth_getBlockByNumber", ["latest", false])]);
    return { chainId: Number.parseInt(chainId, 16), head: Number.parseInt(block.number, 16), headTimestamp: Number.parseInt(block.timestamp, 16) };
  } catch (e) {
    console.error(`EVM endpoint ${EVM_URL}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/** Plain JSON-RPC over a WebSocket, so no Substrate client library is needed. */
async function nativeStatus() {
  if (typeof WebSocket === "undefined") {
    console.error("This Node.js has no global WebSocket (use Node 22 or newer); skipping the native node.");
    return null;
  }
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    let id = 0;
    const pending = new Map();
    const finish = (value, why) => {
      if (why) console.error(`Native node ${WS_URL}: ${why}`);
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // already closed
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null, "timed out"), TIMEOUT_MS * 2);
    const call = (method, params = []) =>
      new Promise((res, rej) => {
        const n = ++id;
        pending.set(n, { res, rej });
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: n, method, params }));
      });
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.error) p.rej(new Error(m.error.message ?? "RPC error"));
      else p.res(m.result);
    };
    ws.onerror = () => finish(null, "connection failed");
    ws.onopen = async () => {
      try {
        const [chain, health, head, finalizedHash] = await Promise.all([call("system_chain"), call("system_health"), call("chain_getHeader"), call("chain_getFinalizedHead")]);
        const finalized = await call("chain_getHeader", [finalizedHash]);
        finish({ chain, head: Number.parseInt(head.number, 16), finalized: Number.parseInt(finalized.number, 16), peers: health.peers, isSyncing: health.isSyncing, shouldHavePeers: health.shouldHavePeers });
      } catch (e) {
        finish(null, e instanceof Error ? e.message : String(e));
      }
    };
  });
}

const [evm, native] = await Promise.all([evmStatus(), nativeStatus()]);
const { verdict, findings } = assess({ evm, native });
const mark = { ok: "OK  ", warn: "WARN", fail: "FAIL" };
console.log(`Portal V3 testnet\n  EVM     ${EVM_URL}\n  native  ${WS_URL}\n`);
for (const f of findings) console.log(`${mark[f.level]}  ${f.text}`);
console.log(`\nVerdict: ${verdict.toUpperCase()}${verdict === "unhealthy" ? "  (do not deploy or send transactions until this clears)" : ""}`);
process.exitCode = verdict === "healthy" ? 0 : verdict === "degraded" ? 1 : 2;
