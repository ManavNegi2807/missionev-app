// Read-only check of a deployed MissionEV contract: code present, owner, oracle, domain separator for this chain + address.
//   PORTAL_RPC_URL=https://… node scripts/verify-deployment.mjs --address 0x… [--artifact MissionEVv2.proposed] [--oracle 0x…] [--owner 0x…]
// It also reports how old the RPC's newest block is, because a node that isn't following the chain gives stale answers.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, getAddress, hashDomain, http } from "viem";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const rpc = process.env.PORTAL_RPC_URL;
const address = opt("address");
const artifactName = opt("artifact") ?? "MissionEVv2.proposed";
if (!/^https?:\/\//.test(rpc ?? "") || !/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) {
  console.error("usage: PORTAL_RPC_URL=https://… node scripts/verify-deployment.mjs --address 0x… [--artifact MissionEVv2.proposed] [--oracle 0x…] [--owner 0x…]");
  process.exitCode = 1;
} else {
  const artifact = JSON.parse(readFileSync(join(root, "contracts", "artifacts", `${artifactName}.json`), "utf8"));
  const c = createPublicClient({ transport: http(rpc, { timeout: 20_000 }) });
  const [chainId, head, code] = await Promise.all([c.getChainId(), c.getBlock(), c.getCode({ address })]);
  const age = Math.round(Date.now() / 1000 - Number(head.timestamp));
  console.log(`chain ${chainId} · newest block #${head.number} is ${Math.round(age / 60)} min old${age > 300 ? "  ← STALE: this node isn't following the chain; absent code below does NOT prove absence" : ""}`);
  const hasCode = Boolean(code && code !== "0x");
  console.log(`code at ${address}: ${hasCode ? `${(code.length - 2) / 2} bytes (artifact ${(artifact.deployedBytecode.length - 2) / 2})` : "none"}`);
  let ok = hasCode;
  if (hasCode) {
    const read = (functionName) => c.readContract({ address, abi: artifact.abi, functionName });
    const [signer, owner, domain, name] = await Promise.all([read("azureOracleSigner"), read("owner"), read("DOMAIN_SEPARATOR"), read("name")]);
    const expected = hashDomain({ domain: { name: "MissionEV", version: "1", chainId, verifyingContract: getAddress(address) }, types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }] } });
    const rows = [
      ["runtime code equals the artifact", code === artifact.deployedBytecode],
      ["DOMAIN_SEPARATOR matches chain id + address", domain === expected],
      ["token name", name === "MissionEV Carbon Reward"],
      ...(opt("oracle") ? [["azureOracleSigner == --oracle", signer.toLowerCase() === opt("oracle").toLowerCase()]] : []),
      ...(opt("owner") ? [["owner == --owner", owner.toLowerCase() === opt("owner").toLowerCase()]] : []),
    ];
    console.log(`azureOracleSigner ${signer}\nowner             ${owner}`);
    for (const [n, pass] of rows) {
      console.log(`${pass ? "OK  " : "FAIL"}  ${n}`);
      ok &&= pass;
    }
  }
  process.exitCode = ok ? 0 : 1;
}
